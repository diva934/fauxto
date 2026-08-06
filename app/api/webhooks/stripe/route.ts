import type Stripe from 'stripe';
import { serverEnv } from '@/lib/env';
import { attributeConversion, CHECKOUT_REF_KEY } from '@/lib/partners';
import { CHECKOUT_METADATA, stripe } from '@/lib/stripe';
import { serviceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';
// La signature est calculée sur le corps BRUT : toute normalisation la casse.
export const dynamic = 'force-dynamic';

/**
 * Webhook Stripe — §3.6 et critère d'acceptation « rejouer deux fois ne crédite
 * qu'une seule fois ».
 *
 * L'idempotence ne repose pas sur un cache applicatif ni sur une vérification
 * « ai-je déjà vu cet événement ? », qui seraient tous deux sujets aux courses.
 * Elle repose sur la contrainte UNIQUE de `credit_transactions.stripe_session_id` :
 * la deuxième insertion viole la contrainte, la fonction Postgres attrape le
 * `unique_violation` et renvoie `false` sans rien modifier. C'est la base de
 * données qui garantit l'unicité, pas le code.
 */

export async function POST(request: Request): Promise<Response> {
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return new Response('Signature absente', { status: 400 });
  }

  let event: Stripe.Event;
  try {
    // `request.text()` donne le corps brut, indispensable à la vérification.
    const raw = await request.text();
    event = stripe().webhooks.constructEvent(raw, signature, serverEnv.stripeWebhookSecret);
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    console.error('[stripe-webhook] Signature invalide :', detail);
    // 400 : Stripe ne rejouera pas un événement dont la signature est fausse.
    return new Response('Signature invalide', { status: 400 });
  }

  if (event.type !== 'checkout.session.completed') {
    // On répond 200 aux événements qu'on n'utilise pas, sinon Stripe les rejoue
    // indéfiniment.
    return new Response('Ignoré', { status: 200 });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  // Un paiement non abouti ne crédite rien, même si la session est « complete ».
  if (session.payment_status !== 'paid') {
    return new Response('Paiement non abouti', { status: 200 });
  }

  const credits = Number(session.metadata?.[CHECKOUT_METADATA.credits] ?? 0);
  const packId = session.metadata?.[CHECKOUT_METADATA.packId] ?? 'inconnu';
  // Identifiant posé par notre serveur au moment de créer la session. On ne
  // retombe volontairement PAS sur `customer_email` : cette valeur est
  // modifiable par l'acheteur dans l'interface Stripe, et créditer d'après elle
  // rouvrirait exactement la faille qu'on vient de fermer.
  const userId = session.metadata?.[CHECKOUT_METADATA.userId] ?? null;

  if (!credits || credits <= 0 || !userId) {
    console.error(
      '[stripe-webhook] Métadonnées incomplètes, impossible de créditer :',
      { sessionId: session.id, credits, userId },
    );
    // 200 volontairement : rejouer n'y changerait rien, et on veut que Stripe
    // arrête. L'incident est journalisé pour traitement manuel.
    return new Response('Métadonnées incomplètes', { status: 200 });
  }

  try {
    const supabase = serviceClient();

    const { data: granted, error } = await supabase.rpc('grant_credits', {
      p_user_id: userId,
      p_delta: credits,
      p_reason: `achat:${packId}`,
      p_stripe_session_id: session.id,
    });

    if (error) {
      console.error('[stripe-webhook] grant_credits a échoué :', error.message);
      // 500 : là, on VEUT que Stripe rejoue.
      return new Response('Échec du crédit', { status: 500 });
    }

    if (granted === false) {
      // Rejeu détecté par la contrainte UNIQUE. Comportement attendu.
      console.info(
        `[stripe-webhook] Session ${session.id} déjà créditée — rejeu ignoré.`,
      );
      return new Response('Déjà traité', { status: 200 });
    }

    console.info(`[stripe-webhook] ${credits} crédit(s) accordé(s) — ${packId}.`);

    // ── Attribution partenaire ────────────────────────────────────────────
    // APRÈS le crédit, et volontairement hors de son sort : une attribution
    // ratée ne doit jamais empêcher un acheteur d'obtenir ce qu'il a payé.
    // Le montant vient de Stripe, pas du pack : c'est ce qui a réellement été
    // encaissé, y compris si le prix du pack change plus tard.
    const refCode = session.metadata?.[CHECKOUT_REF_KEY];
    if (refCode) {
      try {
        const attributed = await attributeConversion({
          code: refCode,
          userId,
          stripeSessionId: session.id,
          amountCents: session.amount_total ?? 0,
        });
        console.info(
          attributed
            ? `[stripe-webhook] Vente attribuée au partenaire ${refCode}.`
            : `[stripe-webhook] Aucune attribution pour ${refCode} (code inconnu, achat par le partenaire lui-même, ou rejeu).`,
        );
      } catch (cause) {
        // On avale : le crédit est déjà accordé, et renvoyer 500 ferait
        // rejouer le webhook, donc retenter un crédit déjà donné.
        const detail = cause instanceof Error ? cause.message : String(cause);
        console.error('[stripe-webhook] Attribution partenaire impossible :', detail);
      }
    }

    return new Response('Crédité', { status: 200 });
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    console.error('[stripe-webhook] Erreur inattendue :', detail);
    return new Response('Erreur serveur', { status: 500 });
  }
}

/*
 * `findOrCreateUser` et `sendMagicLink` ont été supprimés.
 *
 * Ils servaient le modèle précédent, où le compte naissait au moment du
 * paiement : le webhook devait donc créer l'utilisateur puis lui envoyer un
 * lien de connexion. Dans le tunnel actuel, l'acheteur est déjà inscrit et
 * connecté avant d'atteindre Stripe — recréer un compte ou renvoyer un lien
 * n'aurait plus de sens, et la recherche par e-mail était le vecteur qui
 * permettait de créditer le compte d'un tiers.
 */

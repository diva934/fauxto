import type Stripe from 'stripe';
import { serverEnv } from '@/lib/env';
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
  const email =
    session.metadata?.[CHECKOUT_METADATA.email] ??
    session.customer_email ??
    session.customer_details?.email ??
    null;

  if (!credits || credits <= 0 || !email) {
    console.error(
      '[stripe-webhook] Métadonnées incomplètes, impossible de créditer :',
      { sessionId: session.id, credits, email },
    );
    // 200 volontairement : rejouer n'y changerait rien, et on veut que Stripe
    // arrête. L'incident est journalisé pour traitement manuel.
    return new Response('Métadonnées incomplètes', { status: 200 });
  }

  try {
    const supabase = serviceClient();
    const userId = await findOrCreateUser(email);

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

    // Magic link envoyé après le crédit : si l'envoi échoue, l'utilisateur est
    // déjà crédité et pourra se connecter depuis la page de connexion.
    await sendMagicLink(email);

    return new Response('Crédité', { status: 200 });
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    console.error('[stripe-webhook] Erreur inattendue :', detail);
    return new Response('Erreur serveur', { status: 500 });
  }
}

/**
 * Retrouve le compte par e-mail, ou le crée.
 *
 * C'est ici que « création de compte au moment du paiement uniquement » se
 * matérialise : l'utilisateur n'a jamais eu à s'inscrire avant de payer.
 */
async function findOrCreateUser(email: string): Promise<string> {
  const supabase = serviceClient();
  const normalized = email.trim().toLowerCase();

  const { data: existing, error: listError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listError) throw new Error(`listUsers : ${listError.message}`);

  const found = existing.users.find(
    (user) => user.email?.toLowerCase() === normalized,
  );
  if (found) return found.id;

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email: normalized,
    // L'e-mail est confirmé par Stripe : il a servi à encaisser un paiement.
    email_confirm: true,
  });
  if (createError || !created.user) {
    throw new Error(`createUser : ${createError?.message ?? 'utilisateur absent'}`);
  }

  return created.user.id;
}

/** Envoie le lien de connexion pour que l'acheteur accède à ses crédits. */
async function sendMagicLink(email: string): Promise<void> {
  try {
    const supabase = serviceClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${serverEnv.siteUrl}/auth/callback?next=/creer`,
      },
    });
    if (error) console.error('[stripe-webhook] Magic link non envoyé :', error.message);
  } catch (cause) {
    console.error('[stripe-webhook] Magic link non envoyé :', cause);
  }
}

import { z } from 'zod';
import { hasStripe, serverEnv } from '@/lib/env';
import { getPack } from '@/lib/packs';
import { CHECKOUT_METADATA, stripe } from '@/lib/stripe';
import { currentUser } from '@/lib/supabase/server';
import { BRAND } from '@/lib/utils';

export const runtime = 'nodejs';

/**
 * Ouvre une session Stripe Checkout — §3.6.
 *
 * Choix de parcours important : on NE demande PAS à l'utilisateur de créer un
 * compte avant de payer. Il saisit son e-mail, il paie, et c'est le webhook qui
 * crée le compte et envoie le magic link. Un détour par l'authentification
 * avant le paiement coûterait une grosse part des conversions, et le cahier des
 * charges est explicite : « au moment du paiement uniquement ».
 */

const bodySchema = z.object({
  packId: z.string().min(1),
  // Requis seulement si l'utilisateur n'est pas déjà connecté.
  email: z.string().email().optional(),
  /** Page vers laquelle revenir après paiement. */
  next: z.string().max(200).optional(),
});

/**
 * Destinations autorisées au retour de Stripe.
 *
 * Sans cette liste blanche, `next` deviendrait une redirection ouverte : un
 * lien de paiement portant notre domaine pourrait renvoyer l'acheteur vers un
 * site tiers juste après sa saisie de carte. Exactement le scénario recherché
 * en hameçonnage.
 */
function safeReturnPath(next: string | undefined): string {
  if (!next) return '/creer';
  if (['/creer', '/compte', '/credits', '/'].includes(next)) return next;
  if (/^\/creer\/[a-z0-9-]{1,60}$/.test(next)) return next;
  return '/creer';
}

export async function POST(request: Request): Promise<Response> {
  if (!hasStripe()) {
    return Response.json(
      { error: 'Le paiement n’est pas encore configuré sur cette instance.' },
      { status: 503 },
    );
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: 'Requête invalide.' }, { status: 400 });
  }

  const pack = getPack(parsed.packId);
  if (!pack) {
    return Response.json({ error: 'Ce pack n’existe pas.' }, { status: 400 });
  }

  // Authentification OBLIGATOIRE.
  //
  // L'ancien modèle acceptait un e-mail libre parce que le compte naissait au
  // paiement. C'était une faille dans le nouveau tunnel : on pouvait lancer un
  // paiement en indiquant l'adresse d'un tiers, et le webhook, qui retrouvait
  // le compte PAR E-MAIL, aurait crédité ce tiers. On identifie donc par
  // l'identifiant de session, jamais par une valeur venue du client.
  const user = await currentUser();
  if (!user) {
    return Response.json(
      { error: 'Connecte-toi avant de payer.' },
      { status: 401 },
    );
  }

  const siteUrl = serverEnv.siteUrl;
  const returnPath = safeReturnPath(parsed.next);

  try {
    const session = await stripe().checkout.sessions.create({
      // Paiement unique, jamais d'abonnement.
      mode: 'payment',
      customer_email: user.email ?? undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'eur',
            unit_amount: pack.priceCents,
            product_data: {
              name: `${BRAND.name} — ${pack.labelFr}`,
              description: `${pack.credits} générations. Les crédits n’expirent pas.`,
            },
          },
        },
      ],
      // Ces métadonnées sont la seule source de vérité du webhook : il ne
      // recalcule jamais le nombre de crédits depuis le montant payé, et il ne
      // retrouve plus le compte par e-mail. `userId` vient de la session
      // serveur, jamais du corps de la requête.
      metadata: {
        [CHECKOUT_METADATA.packId]: pack.id,
        [CHECKOUT_METADATA.credits]: String(pack.credits),
        [CHECKOUT_METADATA.userId]: user.id,
      },
      // On repasse par /credits/merci, qui attend la confirmation du webhook
      // avant de renvoyer l'acheteur là où il en était. Revenir directement sur
      // la page de génération l'exposerait à un solde encore à zéro : Stripe
      // redirige plus vite que le webhook n'arrive.
      success_url: `${siteUrl}/credits/merci?retour=${encodeURIComponent(returnPath)}`,
      cancel_url: `${siteUrl}${returnPath}?paiement=annule`,
      locale: 'fr',
      // Les CGV sont accessibles depuis la page, on n'ajoute pas de friction.
      allow_promotion_codes: false,
    });

    if (!session.url) {
      return Response.json({ error: 'Stripe n’a pas renvoyé d’URL.' }, { status: 502 });
    }

    return Response.json({ url: session.url });
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    console.error('[checkout] Création de session impossible :', detail);
    return Response.json(
      { error: 'Le paiement est momentanément indisponible.' },
      { status: 502 },
    );
  }
}

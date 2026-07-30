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
});

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

  const user = await currentUser();
  const email = user?.email ?? parsed.email;
  if (!email) {
    return Response.json(
      { error: 'Indique ton e-mail pour recevoir tes crédits.' },
      { status: 400 },
    );
  }

  const siteUrl = serverEnv.siteUrl;

  try {
    const session = await stripe().checkout.sessions.create({
      // Paiement unique, jamais d'abonnement.
      mode: 'payment',
      customer_email: email,
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
      // recalcule jamais le nombre de crédits depuis le montant payé.
      metadata: {
        [CHECKOUT_METADATA.packId]: pack.id,
        [CHECKOUT_METADATA.credits]: String(pack.credits),
        [CHECKOUT_METADATA.email]: email,
      },
      success_url: `${siteUrl}/credits/merci?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/credits?annule=1`,
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

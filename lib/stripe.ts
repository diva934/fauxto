import 'server-only';
import Stripe from 'stripe';
import { serverEnv } from '@/lib/env';

let cached: Stripe | null = null;

export function stripe(): Stripe {
  if (!cached) {
    cached = new Stripe(serverEnv.stripeSecretKey, {
      // Épingler la version d'API évite qu'une mise à jour côté Stripe change
      // silencieusement la forme des objets reçus par le webhook.
      apiVersion: '2026-06-24.dahlia',
      typescript: true,
    });
  }
  return cached;
}

/**
 * Clés de métadonnées portées par la session Checkout.
 *
 * `userId` a remplacé `email` : le webhook créditait auparavant le compte
 * trouvé PAR ADRESSE, ce qui permettait de payer en indiquant l'adresse d'un
 * tiers et de créditer son compte. L'identifiant vient désormais de la session
 * serveur au moment de créer la session Stripe.
 */
export const CHECKOUT_METADATA = {
  packId: 'fauxto_pack_id',
  credits: 'fauxto_credits',
  userId: 'fauxto_user_id',
} as const;

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

/** Clés de métadonnées utilisées sur la session Checkout. */
export const CHECKOUT_METADATA = {
  packId: 'fauxto_pack_id',
  credits: 'fauxto_credits',
  email: 'fauxto_email',
} as const;

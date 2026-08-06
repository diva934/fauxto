import 'server-only';
import { randomBytes } from 'node:crypto';
import { optionalServiceClient } from '@/lib/supabase/service';
import type { PartnerStats } from '@/lib/supabase/types';

/**
 * Programme partenaire.
 *
 * Un partenaire partage `https://<site>/r/<code>`. La chaîne d'attribution
 * tient en quatre temps, et chacun est vérifiable indépendamment :
 *
 *   1. `/r/<code>`   enregistre un clic, pose le cookie, renvoie à l'accueil ;
 *   2. le cookie     survit à la navigation et à la création de compte ;
 *   3. `/api/checkout` recopie le code dans les métadonnées Stripe ;
 *   4. le webhook    attribue le montant RÉELLEMENT encaissé.
 *
 * Le code voyage dans les métadonnées Stripe plutôt que d'être relu depuis le
 * cookie au moment du webhook : le webhook est un appel serveur-à-serveur
 * venant de Stripe, il n'a aucun cookie. Figer le code au moment du paiement
 * garantit aussi qu'un changement de cookie entre-temps ne réattribue pas une
 * vente déjà conclue.
 */

/** Cookie d'attribution. Lisible par le serveur uniquement. */
export const REF_COOKIE = 'fx_ref';

/**
 * Durée d'attribution : 30 jours.
 *
 * Choisi long parce que le parcours réel n'est pas immédiat — quelqu'un voit
 * une vidéo TikTok, clique, regarde, et revient payer plus tard. Une fenêtre
 * courte attribuerait au hasard des ventes que le partenaire a réellement
 * provoquées.
 */
export const REF_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

/** Clé des métadonnées Stripe portant le code partenaire. */
export const CHECKOUT_REF_KEY = 'fauxto_ref';

/** Forme acceptée par la contrainte SQL. */
const CODE_PATTERN = /^[a-z0-9]{4,24}$/;

export function isValidCode(code: string): boolean {
  return CODE_PATTERN.test(code);
}

/**
 * Dérive un code lisible depuis un nom, complété d'un suffixe aléatoire.
 *
 * Lisible, parce qu'un partenaire doit pouvoir dicter son lien à l'oral dans
 * une vidéo. Suffixé, parce que deux « julien » se disputeraient le même code.
 */
export function proposeCode(seed: string): string {
  const base = seed
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // diacritiques combinantes
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 12);

  const suffix = randomBytes(3).toString('hex').slice(0, 4);
  const code = `${base || 'creator'}${suffix}`;
  return code.slice(0, 24);
}

/** Enregistre un clic. Silencieux si le code est inconnu. */
export async function recordClick(
  code: string,
  visitorHash: string | null,
): Promise<boolean> {
  const supabase = optionalServiceClient();
  if (!supabase || !isValidCode(code)) return false;

  const { data, error } = await supabase.rpc('record_partner_click', {
    p_code: code,
    p_visitor_hash: visitorHash,
  });

  if (error) {
    console.error('[partenaire] record_partner_click :', error.message);
    return false;
  }
  return data === true;
}

export type JoinResult =
  | { ok: true; code: string; created: boolean }
  | { ok: false; reason: 'unavailable' | 'failed' };

/**
 * Inscrit un utilisateur comme partenaire, ou renvoie son code existant.
 *
 * Réessaie sur collision de code : le suffixe aléatoire rend le cas rare, mais
 * « rare » n'est pas « impossible », et échouer là ferait perdre un partenaire
 * pour une raison qu'il ne comprendrait pas.
 */
export async function joinPartner(
  userId: string,
  displayName: string | null,
): Promise<JoinResult> {
  const supabase = optionalServiceClient();
  if (!supabase) return { ok: false, reason: 'unavailable' };

  const seed = displayName ?? 'creator';

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data, error } = await supabase.rpc('create_partner', {
      p_user_id: userId,
      p_code: proposeCode(seed),
      p_display_name: displayName,
    });

    if (error) {
      console.error('[partenaire] create_partner :', error.message);
      return { ok: false, reason: 'failed' };
    }

    const row = Array.isArray(data) ? data[0] : null;
    if (row?.code) {
      return { ok: true, code: row.code, created: row.created };
    }
    // `code` nul = collision. On retente avec un autre suffixe.
  }

  console.error('[partenaire] create_partner : 5 collisions de code d’affilée.');
  return { ok: false, reason: 'failed' };
}

/** Tableau de bord. `null` si l'utilisateur n'est pas partenaire. */
export async function getPartnerStats(userId: string): Promise<PartnerStats | null> {
  const supabase = optionalServiceClient();
  if (!supabase) return null;

  const { data, error } = await supabase.rpc('partner_stats', { p_user_id: userId });
  if (error) {
    console.error('[partenaire] partner_stats :', error.message);
    return null;
  }

  const row = Array.isArray(data) ? data[0] : null;
  return row ?? null;
}

/**
 * Attribue un paiement abouti. Appelée par le webhook Stripe uniquement.
 *
 * Renvoie `false` sans bruit dans trois cas légitimes : code inconnu, achat du
 * partenaire par lui-même, et rejeu du webhook. Aucun n'est une erreur.
 */
export async function attributeConversion(input: {
  code: string;
  userId: string;
  stripeSessionId: string;
  amountCents: number;
}): Promise<boolean> {
  const supabase = optionalServiceClient();
  if (!supabase || !isValidCode(input.code)) return false;

  const { data, error } = await supabase.rpc('record_partner_conversion', {
    p_code: input.code,
    p_user_id: input.userId,
    p_stripe_session_id: input.stripeSessionId,
    p_amount_cents: input.amountCents,
  });

  if (error) {
    console.error('[partenaire] record_partner_conversion :', error.message);
    return false;
  }
  return data === true;
}

/** Formate des centimes en euros, pour l'affichage. */
export function formatEuros(cents: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);
}

import 'server-only';
import { computeFingerprint } from '@/lib/anon-session';
import { optionalServiceClient, warnNoSupabaseOnce } from '@/lib/supabase/service';

/**
 * Droit à générer : crédit payant, génération gratuite, ou refus.
 *
 * Toute la logique de solde vit ici et dans les fonctions Postgres. Le client
 * n'en connaît rien : il reçoit un booléen et un nombre de crédits restants,
 * jamais le pouvoir de décider.
 */

/**
 * Droit à générer.
 *
 * Il n'existe plus qu'un seul cas : un compte avec un crédit réservé. La
 * génération gratuite anonyme a été supprimée — chaque image est payée, à
 * partir de 1 € l'unité.
 *
 * Conséquence à connaître : le filigrane commercial (le nom de domaine incrusté
 * en diagonale) était réservé au palier gratuit. Plus de palier gratuit, donc
 * plus de filigrane nulle part. Le produit perd au passage un levier de
 * croissance : chaque image partagée ne porte plus l'adresse du site.
 * La mention légale « Image générée par IA », elle, reste sur TOUTES les
 * images — c'est une obligation, pas une option commerciale.
 */
export type Entitlement = {
  kind: 'credit';
  userId: string;
  /** Le crédit est déjà réservé en base à ce stade. */
  watermarked: false;
  creditsLeft: number;
};

export type EntitlementResult =
  | { granted: true; entitlement: Entitlement }
  | {
      granted: false;
      /** `anonymous` : pas de compte. `no_credits` : compte sans solde. */
      reason: 'anonymous' | 'no_credits';
      creditsLeft: number;
    };

export async function resolveEntitlement(input: {
  userId: string | null;
}): Promise<EntitlementResult> {
  // Aucun compte : plus aucune génération possible. C'est le changement de
  // modèle — il n'y a plus de palier gratuit à offrir à un visiteur anonyme.
  if (!input.userId) {
    return { granted: false, reason: 'anonymous', creditsLeft: 0 };
  }

  const supabase = optionalServiceClient();
  if (!supabase) {
    // Sans base, on ne PEUT PAS savoir si l'utilisateur a payé. Refuser est la
    // seule réponse correcte : l'alternative ouvrirait la génération à tous.
    warnNoSupabaseOnce('la vérification des crédits');
    return { granted: false, reason: 'no_credits', creditsLeft: 0 };
  }

  const { data: reserved, error } = await supabase.rpc('reserve_credit', {
    p_user_id: input.userId,
  });

  if (error) {
    console.error('[credits] reserve_credit a échoué :', error.message);
    return { granted: false, reason: 'no_credits', creditsLeft: 0 };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('credits')
    .eq('id', input.userId)
    .single();

  const creditsLeft = profile?.credits ?? 0;

  if (!reserved) {
    return { granted: false, reason: 'no_credits', creditsLeft };
  }

  return {
    granted: true,
    entitlement: {
      kind: 'credit',
      userId: input.userId,
      watermarked: false,
      creditsLeft,
    },
  };
}

/** Enregistre la consommation définitive après une génération réussie. */
export async function confirmUsage(
  entitlement: Entitlement,
  generationId: string,
): Promise<void> {
  const supabase = optionalServiceClient();
  if (!supabase) return;

  const { error } = await supabase.rpc('confirm_credit', {
    p_user_id: entitlement.userId,
    p_generation_id: generationId,
    p_reason: 'generation',
  });
  if (error) {
    // Le solde est déjà correct (décrémenté par la réservation) : seule la
    // ligne d'historique manque. On le journalise sans casser la réponse.
    console.error('[credits] confirm_credit a échoué :', error.message);
  }
}

/**
 * Rend le crédit réservé quand la génération échoue.
 *
 * Point critique maintenant que TOUT est payant : un échec non remboursé, c'est
 * de l'argent encaissé sans contrepartie. Cette fonction doit être appelée sur
 * chaque chemin d'erreur, sans exception.
 */
export async function refundUsage(
  entitlement: Entitlement,
  generationId: string | null,
): Promise<void> {
  const supabase = optionalServiceClient();
  if (!supabase) return;

  const { error } = await supabase.rpc('refund_credit', {
    p_user_id: entitlement.userId,
    p_generation_id: generationId,
    p_reason: 'refund_failed_generation',
  });
  if (error) console.error('[credits] refund_credit a échoué :', error.message);
}

/** Solde courant, pour l'affichage. */
export async function getCredits(userId: string): Promise<number> {
  const supabase = optionalServiceClient();
  if (!supabase) return 0;

  const { data } = await supabase.from('profiles').select('credits').eq('id', userId).single();
  return data?.credits ?? 0;
}

/** Compteur de preuve sociale de l'accueil. Lu en base, jamais codé en dur. */
export async function getWeeklyGenerationCount(): Promise<number | null> {
  const supabase = optionalServiceClient();
  if (!supabase) return null;

  const { data, error } = await supabase.rpc('weekly_generation_count');
  if (error) {
    console.error('[stats] weekly_generation_count a échoué :', error.message);
    return null;
  }
  return typeof data === 'number' ? data : null;
}

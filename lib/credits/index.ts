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

export type Entitlement =
  | {
      kind: 'credit';
      userId: string;
      /** Le crédit est déjà réservé en base à ce stade. */
      watermarked: false;
      creditsLeft: number;
    }
  | {
      kind: 'free';
      anonSessionId: string | null;
      watermarked: true;
      creditsLeft: null;
    };

export type EntitlementResult =
  | { granted: true; entitlement: Entitlement }
  | {
      granted: false;
      reason: 'no_credits' | 'free_already_used';
      /** Crédits restants, pour afficher le bon écran de paywall. */
      creditsLeft: number;
    };

/**
 * Repli en mémoire quand Supabase n'est pas configuré.
 *
 * Volontairement limité : ça permet de développer le parcours sans base, mais
 * le compteur disparaît au redémarrage. C'est signalé par un avertissement, et
 * le README le dit explicitement — ce n'est pas un mode de production.
 */
const inMemoryFreeUsed = new Set<string>();

export async function resolveEntitlement(input: {
  headers: Headers;
  userId: string | null;
}): Promise<EntitlementResult> {
  const supabase = optionalServiceClient();

  // ── Utilisateur connecté : on tente de réserver un crédit ────────────────
  if (input.userId && supabase) {
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
      // Solde à zéro : on ne retombe PAS sur la génération gratuite. Un compte
      // existant a déjà consommé sa gratuité par construction.
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

  // ── Visiteur anonyme : une seule génération, gratuite et filigranée ──────
  const fingerprint = computeFingerprint(input.headers);

  if (!supabase) {
    warnNoSupabaseOnce('le suivi des générations gratuites');
    if (inMemoryFreeUsed.has(fingerprint)) {
      return { granted: false, reason: 'free_already_used', creditsLeft: 0 };
    }
    inMemoryFreeUsed.add(fingerprint);
    return {
      granted: true,
      entitlement: { kind: 'free', anonSessionId: null, watermarked: true, creditsLeft: null },
    };
  }

  const { data, error } = await supabase.rpc('claim_free_generation', {
    p_fingerprint: fingerprint,
  });

  if (error) {
    console.error('[credits] claim_free_generation a échoué :', error.message);
    // Fail-closed : on préfère refuser que d'ouvrir un accès illimité.
    return { granted: false, reason: 'free_already_used', creditsLeft: 0 };
  }

  const row = Array.isArray(data) ? data[0] : null;
  if (!row?.granted) {
    return { granted: false, reason: 'free_already_used', creditsLeft: 0 };
  }

  return {
    granted: true,
    entitlement: {
      kind: 'free',
      anonSessionId: row.session_id,
      watermarked: true,
      creditsLeft: null,
    },
  };
}

/** Enregistre la consommation définitive après une génération réussie. */
export async function confirmUsage(
  entitlement: Entitlement,
  generationId: string,
): Promise<void> {
  if (entitlement.kind !== 'credit') return;

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
 * Rend ce qui avait été réservé quand la génération échoue.
 * L'utilisateur ne doit jamais payer un échec — ni en crédit, ni en gratuité.
 */
export async function refundUsage(
  entitlement: Entitlement,
  generationId: string | null,
): Promise<void> {
  const supabase = optionalServiceClient();

  if (entitlement.kind === 'credit') {
    if (!supabase) return;
    const { error } = await supabase.rpc('refund_credit', {
      p_user_id: entitlement.userId,
      p_generation_id: generationId,
      p_reason: 'refund_failed_generation',
    });
    if (error) console.error('[credits] refund_credit a échoué :', error.message);
    return;
  }

  // Session anonyme : on rouvre la gratuité.
  if (!supabase) {
    // Rien à faire de fiable en mémoire : on ne connaît pas l'empreinte ici.
    // Le repli en mémoire n'est de toute façon pas un mode de production.
    return;
  }
  if (!entitlement.anonSessionId) return;

  const { error } = await supabase.rpc('release_free_generation', {
    p_session_id: entitlement.anonSessionId,
  });
  if (error) console.error('[credits] release_free_generation a échoué :', error.message);
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

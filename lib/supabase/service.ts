import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { hasSupabase, serverEnv } from '@/lib/env';
import type { Database } from './types';

/**
 * Client à clé service_role — contourne la RLS.
 *
 * ⚠️ Ce module ne doit JAMAIS être importé par un composant client. Le marqueur
 * `server-only` en haut du fichier fait échouer le build si ça arrive, ce qui
 * est exactement le comportement voulu : une clé service_role dans le bundle
 * navigateur donnerait un accès total à la base.
 */

let cached: SupabaseClient<Database> | null = null;

export function serviceClient(): SupabaseClient<Database> {
  if (!cached) {
    cached = createClient<Database>(serverEnv.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}

/**
 * Renvoie le client, ou `null` si Supabase n'est pas configuré.
 *
 * Le parcours de la Phase 2 (génération sans compte) doit fonctionner sur une
 * installation qui n'a que `GEMINI_API_KEY`. Les appels base deviennent alors
 * des non-opérations, avec un avertissement explicite en logs.
 */
export function optionalServiceClient(): SupabaseClient<Database> | null {
  return hasSupabase() ? serviceClient() : null;
}

let warned = false;

/** Avertit une seule fois que la persistance est désactivée. */
export function warnNoSupabaseOnce(context: string): void {
  if (warned) return;
  warned = true;
  console.warn(
    `[supabase] Non configuré — ${context} n'est pas persisté. ` +
      "Le compteur de générations gratuites ne survivra pas à un redémarrage, " +
      'et aucune purge à 24 h ne sera possible. À configurer avant la mise en production.',
  );
}

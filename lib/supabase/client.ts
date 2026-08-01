'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './types';

/**
 * Client Supabase côté navigateur.
 *
 * Nécessaire pour `signInWithOAuth` : la connexion Google repose sur PKCE, et
 * le vérifieur doit être généré et conservé par le navigateur avant la
 * redirection vers Google. Un client serveur ne peut pas le faire — c'est
 * pourquoi ce fichier existe en plus de `server.ts` et `service.ts`.
 *
 * Il n'utilise que la clé anonyme, publique par nature et déjà exposée dans le
 * bundle. Aucune clé de service ici, jamais.
 */

let cached: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function browserSupabase() {
  if (!cached) {
    cached = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    );
  }
  return cached;
}

/** Vrai si Supabase est configuré côté client. */
export function hasBrowserSupabase(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

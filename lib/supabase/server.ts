import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { hasSupabase, serverEnv } from '@/lib/env';
import type { Database } from './types';

/**
 * Client lié à la session de l'utilisateur, soumis à la RLS.
 *
 * À utiliser pour tout ce qui se lit « au nom de » l'utilisateur. Pour écrire un
 * solde ou toucher aux sessions anonymes, passer par `service.ts`.
 */
export async function serverSupabase() {
  const cookieStore = await cookies();

  return createServerClient<Database>(serverEnv.supabaseUrl, serverEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Appelé depuis un Server Component : les cookies y sont en lecture
          // seule. Le rafraîchissement de session est alors géré par le proxy.
        }
      },
    },
  });
}

/** Utilisateur courant, ou `null`. Ne lève jamais si Supabase n'est pas configuré. */
export async function currentUser(): Promise<{ id: string; email: string | null } | null> {
  if (!hasSupabase()) return null;

  try {
    const supabase = await serverSupabase();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    return { id: data.user.id, email: data.user.email ?? null };
  } catch {
    return null;
  }
}

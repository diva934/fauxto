import { redirect } from 'next/navigation';
import type { NextRequest } from 'next/server';
import { serverSupabase } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Point d'atterrissage du magic link Supabase.
 *
 * Échange le code contre une session, puis redirige. La destination est
 * validée contre une liste blanche : accepter un `next` arbitraire ouvrirait
 * une redirection ouverte, exploitable pour du hameçonnage depuis un lien qui
 * porte notre domaine.
 */

const ALLOWED_DESTINATIONS = new Set(['/creer', '/compte', '/credits', '/']);

export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const requested = searchParams.get('next') ?? '/compte';
  const destination = ALLOWED_DESTINATIONS.has(requested) ? requested : '/compte';

  if (!code) {
    redirect('/compte?erreur=lien-invalide');
  }

  const supabase = await serverSupabase();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('[auth] Échange du code impossible :', error.message);
    redirect('/compte?erreur=lien-expire');
  }

  redirect(destination);
}

import { z } from 'zod';
import { computeFingerprint } from '@/lib/anon-session';
import { hasSupabase, serverEnv } from '@/lib/env';
import { checkRateLimit } from '@/lib/rate-limit';
import { serverSupabase } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * Envoie un lien de connexion.
 *
 * `shouldCreateUser: false` est volontaire : un compte ne se crée qu'au moment
 * d'un paiement (§3.6). Ce point d'entrée sert uniquement aux acheteurs qui
 * reviennent, pas à s'inscrire.
 *
 * La réponse est TOUJOURS identique, que l'adresse existe ou non. Renvoyer une
 * erreur « compte inconnu » transformerait ce formulaire en oracle permettant
 * de tester si une adresse donnée est cliente du service.
 */

const bodySchema = z.object({ email: z.string().email().max(200) });

const GENERIC_RESPONSE = {
  ok: true,
  message:
    'Si un compte existe avec cette adresse, le lien de connexion vient de partir.',
} as const;

export async function POST(request: Request): Promise<Response> {
  if (!hasSupabase()) {
    return Response.json(
      { error: 'La connexion n’est pas encore configurée sur cette instance.' },
      { status: 503 },
    );
  }

  try {
    const key = `magic:${computeFingerprint(request.headers)}`;
    const rate = await checkRateLimit(key);
    if (!rate.success) {
      return Response.json(
        { error: 'Trop de demandes. Attends quelques minutes.' },
        { status: 429 },
      );
    }
  } catch {
    // Sans sel configuré, on n'applique pas de limitation.
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: 'Adresse e-mail invalide.' }, { status: 400 });
  }

  try {
    const supabase = await serverSupabase();
    const { error } = await supabase.auth.signInWithOtp({
      email: parsed.email.trim().toLowerCase(),
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${serverEnv.siteUrl}/auth/callback?next=/compte`,
      },
    });
    // On journalise sans le remonter au client, pour ne pas révéler l'existence
    // du compte.
    if (error) console.error('[auth] signInWithOtp :', error.message);
  } catch (cause) {
    console.error('[auth] Envoi du lien impossible :', cause);
  }

  return Response.json(GENERIC_RESPONSE);
}

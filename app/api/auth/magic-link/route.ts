import { z } from 'zod';
import { computeFingerprint } from '@/lib/anon-session';
import { hasSupabase, serverEnv } from '@/lib/env';
import { checkRateLimit } from '@/lib/rate-limit';
import { serverSupabase } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * Envoie un lien de connexion — et crée le compte s'il n'existe pas encore.
 *
 * `shouldCreateUser: true` depuis le passage au modèle « tout payant ». Avant,
 * un compte ne naissait qu'au moment d'un paiement, et ce point d'entrée ne
 * servait qu'aux acheteurs qui revenaient. Le tunnel est désormais l'inverse :
 * on crée son compte AVANT de choisir un prank, donc l'inscription doit passer
 * par ici. Avec `false`, plus personne ne pouvait entrer dans le produit.
 *
 * La réponse reste TOUJOURS identique, que l'adresse existe ou non — sinon le
 * formulaire deviendrait un oracle permettant de tester si une adresse donnée
 * est cliente du service.
 */

const bodySchema = z.object({
  email: z.string().email().max(200),
  /** Destination après connexion. Validée côté callback, jamais ici. */
  next: z.string().max(200).optional(),
});

const GENERIC_RESPONSE = {
  ok: true,
  message: 'Ton lien de connexion vient de partir. Regarde tes e-mails.',
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
    // La destination n'est pas validée ici : le callback la confronte à sa
    // liste blanche. Ce point d'entrée ne doit rien décider sur la redirection.
    const next = parsed.next ?? '/compte';
    const supabase = await serverSupabase();
    const { error } = await supabase.auth.signInWithOtp({
      email: parsed.email.trim().toLowerCase(),
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${serverEnv.siteUrl}/auth/callback?next=${encodeURIComponent(next)}`,
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

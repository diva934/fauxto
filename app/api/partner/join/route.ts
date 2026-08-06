import { z } from 'zod';
import { joinPartner } from '@/lib/partners';
import { currentUser } from '@/lib/supabase/server';

/**
 * Inscription au programme partenaire.
 *
 * L'identité vient de la session serveur, jamais du corps de la requête : le
 * seul champ accepté est un nom d'affichage, qui ne sert qu'à dériver un code
 * lisible. Sans cette règle, on pourrait créer un partenariat au nom d'un tiers.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  displayName: z.string().trim().max(60).optional(),
});

export async function POST(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) {
    return Response.json({ error: 'Connecte-toi d’abord.' }, { status: 401 });
  }

  let displayName: string | null = null;
  try {
    const parsed = bodySchema.parse(await request.json());
    displayName = parsed.displayName?.trim() || null;
  } catch {
    return Response.json({ error: 'Requête invalide.' }, { status: 400 });
  }

  // À défaut de nom saisi, la partie locale de l'adresse donne un code
  // reconnaissable par le partenaire lui-même.
  const seed = displayName ?? user.email?.split('@')[0] ?? null;

  const result = await joinPartner(user.id, seed);

  if (!result.ok) {
    const status = result.reason === 'unavailable' ? 503 : 500;
    return Response.json(
      { error: 'Le programme partenaire est momentanément indisponible.' },
      { status },
    );
  }

  return Response.json({ code: result.code, created: result.created });
}

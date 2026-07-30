import { z } from 'zod';
import { computeFingerprint } from '@/lib/anon-session';
import { checkRateLimit } from '@/lib/rate-limit';
import { optionalServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';

/**
 * Réception des signalements — §7.4.
 *
 * Le signalement est enregistré en base plutôt que seulement journalisé : une
 * ligne de log disparaît au redéploiement, et en cas de litige il faut pouvoir
 * démontrer qu'on a reçu et traité l'alerte.
 *
 * Si la base n'est pas configurée, on ne perd pas le signalement en silence :
 * on le trace en `console.error` avec un préfixe repérable, ET on renvoie
 * quand même un succès au plaignant. Le contraire — afficher une erreur à
 * quelqu'un qui signale une photo de mineur — serait la pire réponse possible.
 */

const bodySchema = z.object({
  reason: z.enum(['minor', 'sexual_content', 'my_image', 'harassment', 'other']),
  message: z.string().min(10).max(2000),
  contactEmail: z.string().email().max(200).optional(),
  generationId: z.string().uuid().optional(),
});

export async function POST(request: Request): Promise<Response> {
  // Limitation de débit sur l'empreinte : un formulaire public ouvert est une
  // cible de spam. La clé est distincte de celle de /api/generate pour qu'un
  // signalement ne consomme pas le quota de génération, et inversement.
  try {
    const key = `report:${computeFingerprint(request.headers)}`;
    const rate = await checkRateLimit(key);
    if (!rate.success) {
      return Response.json(
        { error: 'Trop de signalements envoyés d’affilée. Réessaie dans quelques minutes.' },
        { status: 429 },
      );
    }
  } catch {
    // FINGERPRINT_SALT absente : on continue sans limitation plutôt que de
    // refuser un signalement. La disponibilité primait ici.
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return Response.json(
      { error: 'Merci de choisir un motif et de décrire la situation en quelques mots.' },
      { status: 400 },
    );
  }

  const priority = parsed.reason === 'minor' || parsed.reason === 'sexual_content';

  const supabase = optionalServiceClient();
  if (!supabase) {
    console.error(
      `[SIGNALEMENT NON PERSISTÉ]${priority ? ' [PRIORITAIRE]' : ''} ` +
        `motif=${parsed.reason} contact=${parsed.contactEmail ?? 'aucun'} ` +
        `message=${parsed.message.replace(/\s+/g, ' ').slice(0, 500)}`,
    );
    return Response.json({ ok: true, persisted: false });
  }

  const { error } = await supabase.from('reports').insert({
    reason: parsed.reason,
    message: parsed.message,
    contact_email: parsed.contactEmail ?? null,
    generation_id: parsed.generationId ?? null,
    status: 'open',
  });

  if (error) {
    // Même en cas d'échec d'écriture, on trace le contenu pour ne rien perdre.
    console.error(
      `[SIGNALEMENT NON PERSISTÉ]${priority ? ' [PRIORITAIRE]' : ''} ` +
        `erreur=${error.message} motif=${parsed.reason} ` +
        `message=${parsed.message.replace(/\s+/g, ' ').slice(0, 500)}`,
    );
    return Response.json({ ok: true, persisted: false });
  }

  if (priority) {
    console.warn(`[signalement] Nouveau signalement PRIORITAIRE (${parsed.reason}).`);
  }

  return Response.json({ ok: true, persisted: true });
}

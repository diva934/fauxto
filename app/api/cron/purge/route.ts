import { timingSafeEqual } from 'node:crypto';
import { hasSupabase, serverEnv } from '@/lib/env';
import { serviceClient } from '@/lib/supabase/service';
import { GENERATIONS_BUCKET } from '@/lib/supabase/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Purge des images de plus de 24 h — §7.3.
 *
 * Ce n'est pas de l'hygiène de stockage, c'est une obligation : la photo du
 * visage d'une personne est une donnée potentiellement biométrique, et on n'a
 * aucune raison légitime de la conserver après le partage.
 *
 * L'ordre des opérations compte : on supprime d'abord le FICHIER, puis on efface
 * le chemin en base. L'inverse laisserait des fichiers orphelins dans le bucket,
 * sans plus aucun moyen de les retrouver — donc conservés indéfiniment.
 *
 * Déclenché par Vercel Cron (voir vercel.json).
 */

const BATCH_SIZE = 500;

function authorized(request: Request): boolean {
  const header = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${serverEnv.cronSecret}`;

  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function GET(request: Request): Promise<Response> {
  // Vercel Cron envoie `Authorization: Bearer $CRON_SECRET`. Sans ce contrôle,
  // n'importe qui pourrait déclencher une purge.
  let isAuthorized: boolean;
  try {
    isAuthorized = authorized(request);
  } catch {
    return Response.json({ error: 'CRON_SECRET non configuré' }, { status: 500 });
  }
  if (!isAuthorized) {
    return Response.json({ error: 'Non autorisé' }, { status: 401 });
  }

  if (!hasSupabase()) {
    return Response.json(
      { error: 'Supabase non configuré : aucune purge possible' },
      { status: 503 },
    );
  }

  const supabase = serviceClient();

  const { data: expired, error: listError } = await supabase.rpc(
    'expired_generation_paths',
    { p_limit: BATCH_SIZE },
  );

  if (listError) {
    console.error('[purge] Lecture des expirés impossible :', listError.message);
    return Response.json({ error: listError.message }, { status: 500 });
  }

  const rows = (expired ?? []).filter(
    (row): row is { id: string; output_path: string } => Boolean(row.output_path),
  );

  if (rows.length === 0) {
    return Response.json({ purged: 0, remaining: 0, message: 'Rien à purger' });
  }

  // 1. Suppression des fichiers.
  const paths = rows.map((row) => row.output_path);
  const { error: storageError } = await supabase.storage
    .from(GENERATIONS_BUCKET)
    .remove(paths);

  if (storageError) {
    console.error('[purge] Suppression Storage impossible :', storageError.message);
    // On n'efface PAS les lignes : sans elles, les fichiers deviendraient
    // introuvables. On réessaiera au prochain passage.
    return Response.json({ error: storageError.message }, { status: 500 });
  }

  // 2. Effacement des chemins, une fois les fichiers réellement partis.
  const { data: purgedCount, error: markError } = await supabase.rpc(
    'mark_generations_purged',
    { p_ids: rows.map((row) => row.id) },
  );

  if (markError) {
    console.error('[purge] Mise à jour des lignes impossible :', markError.message);
    return Response.json({ error: markError.message }, { status: 500 });
  }

  const purged = typeof purgedCount === 'number' ? purgedCount : rows.length;
  console.info(`[purge] ${purged} image(s) supprimée(s).`);

  return Response.json({
    purged,
    // Si le lot était plein, il reste probablement du travail : le cron
    // repassera, et on le signale pour le monitoring.
    remaining: rows.length === BATCH_SIZE ? 'lot plein, purge à poursuivre' : 0,
  });
}

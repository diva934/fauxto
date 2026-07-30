import { hasSupabase } from '@/lib/env';
import { currentUser, serverSupabase } from '@/lib/supabase/server';
import { serviceClient } from '@/lib/supabase/service';
import { GENERATIONS_BUCKET } from '@/lib/supabase/types';

export const runtime = 'nodejs';

/**
 * Suppression du compte et de toutes les données associées — §7.3.
 *
 * L'ordre des opérations est délibéré :
 *   1. les FICHIERS du Storage d'abord — une fois les lignes parties, plus rien
 *      ne permet de retrouver les chemins, et les images resteraient
 *      indéfiniment dans le bucket ;
 *   2. l'utilisateur `auth.users` ensuite. Les cascades définies dans la
 *      migration emportent `profiles`, `credit_transactions`, et détachent
 *      `generations` — donc une seule suppression suffit pour le reste.
 *
 * Irréversible et assumé comme tel : les CGU précisent que les crédits
 * restants sont perdus.
 */
export async function POST(): Promise<Response> {
  if (!hasSupabase()) {
    return Response.json(
      { error: 'Service indisponible sur cette instance.' },
      { status: 503 },
    );
  }

  const user = await currentUser();
  if (!user) {
    return Response.json({ error: 'Tu n’es pas connecté.' }, { status: 401 });
  }

  const supabase = serviceClient();

  // 1. Fichiers du Storage.
  const { data: generations, error: listError } = await supabase
    .from('generations')
    .select('output_path')
    .eq('user_id', user.id)
    .not('output_path', 'is', null);

  if (listError) {
    console.error('[compte] Lecture des générations impossible :', listError.message);
    return Response.json({ error: 'La suppression a échoué.' }, { status: 500 });
  }

  const paths = (generations ?? [])
    .map((row) => row.output_path)
    .filter((path): path is string => Boolean(path));

  if (paths.length > 0) {
    const { error: storageError } = await supabase.storage
      .from(GENERATIONS_BUCKET)
      .remove(paths);
    if (storageError) {
      console.error('[compte] Suppression Storage impossible :', storageError.message);
      // On s'arrête : supprimer le compte maintenant rendrait ces fichiers
      // orphelins et impossibles à retrouver.
      return Response.json({ error: 'La suppression a échoué.' }, { status: 500 });
    }
  }

  // 2. L'utilisateur — les cascades font le reste.
  const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error('[compte] Suppression du compte impossible :', deleteError.message);
    return Response.json({ error: 'La suppression a échoué.' }, { status: 500 });
  }

  // 3. Session locale.
  try {
    const client = await serverSupabase();
    await client.auth.signOut();
  } catch {
    // La session est de toute façon devenue invalide.
  }

  console.info(`[compte] Compte supprimé, ${paths.length} image(s) effacée(s).`);
  return Response.json({ ok: true, filesRemoved: paths.length });
}

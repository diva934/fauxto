import { NextResponse, type NextRequest } from 'next/server';

/**
 * Sonde de diagnostic temporaire.
 *
 * POURQUOI ELLE EXISTE
 *
 * `/api/generate` renvoie un 500 en production alors que le MÊME build passe en
 * local : une requête volontairement invalide, qui devrait donner un 400 JSON,
 * renvoie la page d'erreur HTML de Next. Le module de la route échoue donc à se
 * charger, et l'échec est propre à l'environnement Vercel.
 *
 * Sans accès aux journaux d'exécution Vercel, l'erreur est invisible. Cette
 * route la rend lisible : elle tente de charger chaque module suspect isolément
 * et rapporte lequel échoue, avec son message.
 *
 * ELLE NE DIVULGUE AUCUN SECRET : uniquement des booléens de présence pour les
 * variables d'environnement, jamais leur valeur.
 *
 * À SUPPRIMER une fois le diagnostic établi.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Charge un module et rapporte l'échec au lieu de le propager. */
async function tryLoad(name: string, load: () => Promise<unknown>) {
  const started = Date.now();
  try {
    await load();
    return { module: name, ok: true, ms: Date.now() - started };
  } catch (error) {
    return {
      module: name,
      ok: false,
      ms: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Garde-fou : la sonde reste inaccessible sans le jeton, même si elle ne
  // révèle que des booléens. Le jeton passe par un en-tête et non par l'URL :
  // une URL se retrouve dans les journaux d'accès et l'historique.
  const token = request.headers.get('x-diagnostic-token');
  const expected = process.env.CRON_SECRET;
  if (!expected || token !== expected) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const modules = [
    await tryLoad('sharp', () => import('sharp')),
    await tryLoad('c2pa-node', () => import('c2pa-node')),
    await tryLoad('@google/genai', () => import('@google/genai')),
    await tryLoad('@upstash/ratelimit', () => import('@upstash/ratelimit')),
    await tryLoad('lib/postprocess', () => import('@/lib/postprocess')),
    await tryLoad('lib/moderation', () => import('@/lib/moderation')),
    await tryLoad('lib/image-engine', () => import('@/lib/image-engine')),
    await tryLoad('lib/rate-limit', () => import('@/lib/rate-limit')),
    await tryLoad('lib/supabase/service', () => import('@/lib/supabase/service')),
    await tryLoad('lib/anon-session', () => import('@/lib/anon-session')),
  ];

  // Un test réel de sharp : le module peut s'importer et échouer à l'exécution
  // si le binaire natif de la plate-forme manque.
  let sharpRuntime: { ok: boolean; error?: string; info?: string };
  try {
    const sharp = (await import('sharp')).default;
    const png = await sharp({
      create: { width: 8, height: 8, channels: 3, background: '#000' },
    })
      .png()
      .toBuffer();
    sharpRuntime = { ok: true, info: `${png.byteLength} octets produits` };
  } catch (error) {
    sharpRuntime = {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  // Présence uniquement : aucune valeur n'est renvoyée.
  const names = [
    'GEMINI_API_KEY',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'FINGERPRINT_SALT',
    'CRON_SECRET',
    'NEXT_PUBLIC_SITE_URL',
    'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN',
    'GEMINI_IMAGE_MODEL',
    'GEMINI_IMAGE_PRO_MODEL',
  ];
  const env = Object.fromEntries(
    names.map((n) => [n, Boolean(process.env[n]?.trim())]),
  );

  return NextResponse.json(
    {
      node: process.version,
      platform: `${process.platform}-${process.arch}`,
      modules: modules.filter((m) => !m.ok).length ? modules : 'tous chargés',
      echecs: modules.filter((m) => !m.ok),
      sharpRuntime,
      env,
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? '(absente)',
    },
    { status: 200 },
  );
}

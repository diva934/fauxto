import { NextResponse, type NextRequest } from 'next/server';
import { computeFingerprint } from '@/lib/anon-session';
import { isValidCode, recordClick, REF_COOKIE, REF_COOKIE_MAX_AGE } from '@/lib/partners';

/**
 * Lien créateur à la racine : `fauxto.online/leo.ktn`.
 *
 * POURQUOI. Le pseudo TikTok est déjà connu du spectateur — il vient de le
 * lire sous la vidéo. Une adresse qui le reprend n'ajoute rien à retenir, là
 * où `/r/leo` demande de mémoriser une convention en plus. Sur un canal où le
 * lien n'est pas cliquable et où tout se joue à l'oral, c'est décisif.
 *
 * COMMENT ON ÉVITE D'ÉCRASER LE SITE. Une route attrape-tout à la racine
 * capture, par construction, tout ce qui n'est pas déjà servi. Deux garde-fous :
 *
 *   1. Next.js donne TOUJOURS la priorité aux segments statiques. `/compte`,
 *      `/creer`, `/credits`, `/partenaire`, `/prank/...`, `/admin/...` et les
 *      pages légales continuent donc de gagner sans intervention.
 *
 *   2. `RESERVED` verrouille en plus les chemins qui n'existent pas encore.
 *      Sans cette liste, créer un jour la page `/tarifs` alors qu'un créateur
 *      a le code `tarifs` casserait silencieusement l'une des deux — et on
 *      chercherait longtemps.
 *
 * Un code inconnu ne renvoie pas d'erreur : il ramène à l'accueil, exactement
 * comme `/r/<code>`. Une faute de frappe du créateur ne doit pas laisser le
 * visiteur devant une page morte.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Chemins qu'un code ne pourra jamais prendre.
 *
 * Inclut les pages existantes (ceinture et bretelles) et une réserve de mots
 * qu'un site marchand finit toujours par utiliser.
 */
const RESERVED = new Set([
  'compte', 'credits', 'creer', 'partenaire', 'prank', 'admin', 'api', 'auth', 'r',
  'cgu', 'cgv', 'mentions-legales', 'confidentialite', 'signaler',
  'tarifs', 'prix', 'pricing', 'aide', 'contact', 'blog', 'faq', 'app',
  'login', 'signin', 'signup', 'inscription', 'connexion', 'compte-supprime',
  'favicon.ico', 'robots.txt', 'sitemap.xml', 'manifest.webmanifest', 'sw.js',
]);

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ handle: string }> },
): Promise<NextResponse> {
  const { handle } = await context.params;
  const code = decodeURIComponent(handle).toLowerCase();

  const home = new URL('/', request.nextUrl.origin);
  const response = NextResponse.redirect(home);

  if (RESERVED.has(code) || !isValidCode(code)) return response;

  let visitorHash: string | null = null;
  try {
    visitorHash = computeFingerprint(request.headers);
  } catch {
    visitorHash = null;
  }

  const known = await recordClick(code, visitorHash);
  if (!known) return response;

  response.cookies.set(REF_COOKIE, code, {
    maxAge: REF_COOKIE_MAX_AGE,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });

  return response;
}

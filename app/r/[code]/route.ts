import { NextResponse, type NextRequest } from 'next/server';
import { computeFingerprint } from '@/lib/anon-session';
import { recordClick, REF_COOKIE, REF_COOKIE_MAX_AGE, isValidCode } from '@/lib/partners';

/**
 * Point d'entrée des liens partenaires : `https://<site>/r/<code>`.
 *
 * Enregistre le clic, pose le cookie d'attribution, puis renvoie à l'accueil.
 *
 * POURQUOI UNE ROUTE DÉDIÉE plutôt qu'un `?ref=` capté partout : le paramètre
 * traînerait dans toutes les URL partagées ensuite, se retrouverait dans les
 * moteurs de recherche, et il faudrait interroger la base à chaque requête du
 * site pour savoir s'il est présent. Une route dédiée ne coûte que sur le clic
 * réel, et l'adresse est dictable à l'oral dans une vidéo.
 *
 * Le code est LU MAIS NON VÉRIFIÉ avant redirection : un code inconnu pose
 * quand même le cookie et renvoie à l'accueil. Renvoyer une erreur
 * apprendrait à un curieux quels codes existent, et punirait un visiteur pour
 * une faute de frappe du partenaire.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ code: string }> },
): Promise<NextResponse> {
  const { code: raw } = await context.params;
  const code = raw.toLowerCase();

  const destination = new URL('/', request.nextUrl.origin);
  const response = NextResponse.redirect(destination);

  if (!isValidCode(code)) return response;

  // Empreinte salée, jamais l'IP : c'est ce qui permet de distinguer un
  // visiteur unique d'un rechargement sans conserver de donnée personnelle.
  let visitorHash: string | null = null;
  try {
    visitorHash = computeFingerprint(request.headers);
  } catch {
    // FINGERPRINT_SALT absente : on enregistre le clic sans empreinte plutôt
    // que de le perdre. Le total reste juste, seul l'unique devient inconnu.
    visitorHash = null;
  }

  await recordClick(code, visitorHash);

  response.cookies.set(REF_COOKIE, code, {
    maxAge: REF_COOKIE_MAX_AGE,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });

  return response;
}

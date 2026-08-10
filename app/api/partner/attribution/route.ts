import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { computeFingerprint } from '@/lib/anon-session';
import { isValidCode, recordClick, REF_COOKIE, REF_COOKIE_MAX_AGE } from '@/lib/partners';

/**
 * Attribution par code SAISI À LA MAIN.
 *
 * POURQUOI CETTE ROUTE EXISTE. TikTok n'autorise pas les liens cliquables pour
 * la plupart des comptes, et son navigateur intégré ne transmet ni le compte
 * d'origine ni un `Referer` exploitable. Le lien `/r/<code>` reste donc
 * inutilisable pour les créateurs qui n'ont pas droit au lien en bio.
 *
 * Le code dicté à l'oral dans la vidéo — « code LÉA sur fauxto.online » — est
 * alors le seul canal d'attribution qui fonctionne. Cette route fait
 * exactement ce que fait `/r/<code>`, mais déclenchée par une saisie plutôt
 * que par un clic : même enregistrement de visite, même cookie, même durée.
 *
 * Elle ne crédite rien et ne modifie aucun solde : elle ne fait que rattacher
 * le visiteur à un créateur. La commission ne naît qu'au paiement, via le
 * webhook Stripe.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({ code: z.string().trim().min(1).max(32) });

export async function POST(request: NextRequest): Promise<NextResponse> {
  let code: string;
  try {
    code = bodySchema.parse(await request.json()).code.toLowerCase();
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }

  if (!isValidCode(code)) {
    return NextResponse.json({ error: 'Ce code n’existe pas.' }, { status: 404 });
  }

  // Empreinte salée, jamais l'IP — même traitement que le clic sur un lien.
  let visitorHash: string | null = null;
  try {
    visitorHash = computeFingerprint(request.headers);
  } catch {
    visitorHash = null;
  }

  const known = await recordClick(code, visitorHash);

  if (!known) {
    // On distingue ici « code inconnu » de « code valide », contrairement à
    // `/r/<code>` : la personne vient de TAPER ce code, elle a besoin de savoir
    // qu'elle s'est trompée. Sur un lien, le silence protégeait contre
    // l'énumération ; ici, l'utilisateur mérite une réponse utile.
    return NextResponse.json({ error: 'Ce code n’existe pas.' }, { status: 404 });
  }

  const response = NextResponse.json({ code });
  response.cookies.set(REF_COOKIE, code, {
    maxAge: REF_COOKIE_MAX_AGE,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
  return response;
}

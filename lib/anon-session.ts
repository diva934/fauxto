import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { serverEnv } from '@/lib/env';

/**
 * Identification des visiteurs sans compte, pour la génération gratuite.
 *
 * Deux exigences qui se contredisent en apparence :
 *   - RGPD : ne JAMAIS stocker d'adresse IP en clair (§7.3) ;
 *   - anti-abus : la première génération gratuite ne doit pas se réinitialiser
 *     en vidant le localStorage (critère d'acceptation explicite).
 *
 * La réponse est un empreinte HMAC salée, calculée côté serveur à partir de
 * l'IP et du user-agent. On ne peut pas remonter à l'IP depuis l'empreinte sans
 * le sel, et le client ne détient rien qui, effacé, débloquerait un tour gratuit.
 * Le cookie posé n'est qu'un confort d'affichage : il n'ouvre aucun droit.
 */

/** En-têtes examinés pour retrouver l'IP réelle derrière les proxys. */
const IP_HEADERS = [
  'x-forwarded-for',
  'x-real-ip',
  'cf-connecting-ip',
  'x-vercel-forwarded-for',
] as const;

export function extractClientIp(headers: Headers): string {
  for (const name of IP_HEADERS) {
    const value = headers.get(name);
    if (!value) continue;
    // `x-forwarded-for` est une liste : le client d'origine est en premier.
    const first = value.split(',')[0]?.trim();
    if (first) return first;
  }
  // Développement local, ou en-têtes absents : on retombe sur une valeur
  // constante. Ça regroupe tous les visiteurs locaux sous une même empreinte,
  // ce qui est exactement le comportement souhaité en dev.
  return 'unknown-ip';
}

/**
 * Empreinte anti-abus. Ne contient aucune donnée personnelle exploitable :
 * c'est un HMAC-SHA256 tronqué, salé par une variable d'environnement.
 */
export function computeFingerprint(headers: Headers): string {
  const ip = extractClientIp(headers);
  const userAgent = headers.get('user-agent') ?? 'unknown-ua';

  return createHmac('sha256', serverEnv.fingerprintSalt)
    .update(`${ip}::${userAgent}`)
    .digest('hex')
    .slice(0, 32);
}

/** Nom du cookie qui mémorise la session anonyme. Confort, pas autorisation. */
export const ANON_COOKIE = 'fx_anon';

/**
 * Signe l'identifiant de session pour qu'il ne soit pas forgeable.
 * Sans ça, n'importe qui pourrait présenter l'identifiant d'une autre session.
 */
export function signSessionId(sessionId: string): string {
  const signature = createHmac('sha256', serverEnv.fingerprintSalt)
    .update(sessionId)
    .digest('base64url')
    .slice(0, 24);
  return `${sessionId}.${signature}`;
}

/** Vérifie la signature et renvoie l'identifiant, ou `null` s'il est invalide. */
export function verifySessionCookie(value: string | undefined): string | null {
  if (!value) return null;
  const separator = value.lastIndexOf('.');
  if (separator <= 0) return null;

  const sessionId = value.slice(0, separator);
  const provided = value.slice(separator + 1);
  const expected = createHmac('sha256', serverEnv.fingerprintSalt)
    .update(sessionId)
    .digest('base64url')
    .slice(0, 24);

  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length) return null;
  // Comparaison à temps constant : évite de fuir la signature attendue.
  return timingSafeEqual(providedBuffer, expectedBuffer) ? sessionId : null;
}

/** Détecte les navigateurs intégrés (TikTok, Instagram…) où l'installation PWA est impossible. */
export function isInAppBrowser(userAgent: string): boolean {
  return /TikTok|musical_ly|Instagram|FBAN|FBAV|FB_IAB|Snapchat|Line\/|Twitter/i.test(
    userAgent,
  );
}

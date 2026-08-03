import { NextResponse, type NextRequest } from 'next/server';

/**
 * Rattrape les codes d'authentification qui arrivent sur la mauvaise page.
 *
 * POURQUOI CE FICHIER EXISTE
 *
 * Supabase refuse toute URL de redirection absente de sa liste blanche
 * (Authentication > URL Configuration > Redirect URLs). Quand ça arrive, il ne
 * renvoie pas d'erreur : il retombe silencieusement sur le *Site URL*, c'est-à-
 * dire la racine du site.
 *
 * Le code d'authentification atterrit alors sur `/`, qui n'a aucun échangeur.
 * Le code est perdu, aucune session n'est créée, et l'utilisateur reste
 * déconnecté — sans le moindre message d'erreur. Sur ce produit, où le compte
 * est obligatoire avant tout paiement, ça bloque la totalité du tunnel.
 *
 * C'est exactement ce qui s'est produit au changement de domaine vers
 * fauxto.online : le callback de l'ancien domaine était autorisé, pas celui du
 * nouveau.
 *
 * Ce filet renvoie le code vers `/auth/callback` d'où qu'il arrive. La
 * configuration Supabase reste à corriger — c'est la vraie solution — mais une
 * liste blanche incomplète ne peut plus faire tomber le produit entier.
 *
 * Note Next 16 : le fichier s'appelle `proxy.ts` et non `middleware.ts`, la
 * convention ayant été renommée. Le runtime est Node et n'est pas configurable.
 */

const CALLBACK = '/auth/callback';

export function proxy(request: NextRequest): NextResponse {
  const { pathname, searchParams } = request.nextUrl;

  // Déjà au bon endroit, ou pas de code à rattraper : on ne touche à rien.
  if (pathname === CALLBACK) return NextResponse.next();

  const code = searchParams.get('code');
  if (!code) return NextResponse.next();

  // Un `code` sur une route d'API n'est pas un code d'authentification.
  if (pathname.startsWith('/api/')) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = CALLBACK;

  // On conserve la destination si elle était présente, sinon on renvoie vers
  // le compte. `/auth/callback` applique de toute façon sa propre liste
  // blanche sur ce paramètre : rien d'arbitraire ne passe.
  if (!searchParams.get('next')) {
    url.searchParams.set('next', pathname === '/' ? '/compte' : pathname);
  }

  console.info(`[proxy] Code d'authentification rattrapé sur ${pathname}.`);
  return NextResponse.redirect(url);
}

export const config = {
  /**
   * On exclut les ressources statiques : un code d'authentification n'arrive
   * jamais sur une image ou un fichier de build, et les intercepter coûterait
   * une invocation de fonction à chaque requête.
   */
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|splash|samples|logo).*)'],
};

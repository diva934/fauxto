/**
 * Service worker — Fauxto.
 *
 * POURQUOI IL EXISTE. Chrome ne déclenche `beforeinstallprompt` que si un
 * service worker doté d'un gestionnaire `fetch` est enregistré. Sans lui,
 * `InstallPrompt` était du code mort sur Android : l'événement n'arrivait
 * jamais, et l'invitation à installer ne s'affichait pas.
 *
 * CE QU'IL NE MET JAMAIS EN CACHE, et c'est le point important :
 *   · `/api/*` — générations, paiements, authentification. Servir une réponse
 *     en cache ici irait de la simple incohérence de solde à la reprise d'une
 *     session qui n'existe plus ;
 *   · les images générées, où qu'elles viennent. Le produit promet une
 *     suppression sous 24 h ; en garder une copie dans le cache du navigateur
 *     contredirait cette promesse sans que personne ne le sache ;
 *   · tout ce qui n'est pas une requête GET.
 *
 * Sa politique tient en deux règles :
 *   · les fichiers de build, immuables par construction, sont servis depuis le
 *     cache en priorité ;
 *   · tout le reste passe par le réseau, avec le cache en filet de secours
 *     seulement quand le réseau est absent.
 */

const VERSION = 'fauxto-v1';
const STATIC_CACHE = `${VERSION}-static`;
const PAGE_CACHE = `${VERSION}-pages`;

/** Chemins servis en priorité depuis le cache : leur contenu ne change jamais. */
const IMMUTABLE = [/^\/_next\/static\//, /^\/icons\//, /^\/splash\//, /^\/logo/];

/** Rien de ce qui suit ne doit jamais atterrir dans un cache. */
const NEVER_CACHE = [/^\/api\//, /^\/auth\//, /^\/r\//];

self.addEventListener('install', (event) => {
  // Le nouveau worker prend la main sans attendre la fermeture des onglets.
  self.skipWaiting();
  event.waitUntil(caches.open(STATIC_CACHE));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((name) => !name.startsWith(VERSION)).map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

function isImmutable(pathname) {
  return IMMUTABLE.some((pattern) => pattern.test(pathname));
}

function isForbidden(pathname) {
  return NEVER_CACHE.some((pattern) => pattern.test(pathname));
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Les requêtes non-GET ne sont jamais mises en cache : un POST rejoué depuis
  // un cache créerait un paiement ou une génération fantôme.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Domaines tiers — Supabase Storage en particulier, d'où viennent les images
  // générées. On laisse passer sans jamais conserver de copie.
  if (url.origin !== self.location.origin) return;

  if (isForbidden(url.pathname)) return;

  if (isImmutable(url.pathname)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;

        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(STATIC_CACHE);
          cache.put(request, response.clone());
        }
        return response;
      })(),
    );
    return;
  }

  // Pages : réseau d'abord, cache en secours. L'inverse servirait une version
  // périmée du tunnel de paiement, ce qui est bien pire qu'une page lente.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          if (response.ok) {
            const cache = await caches.open(PAGE_CACHE);
            cache.put(request, response.clone());
          }
          return response;
        } catch {
          const cached = await caches.match(request);
          if (cached) return cached;
          // Dernier recours : l'accueil, s'il a déjà été visité.
          const home = await caches.match('/');
          if (home) return home;
          return new Response(
            '<!doctype html><meta charset="utf-8"><title>Hors ligne</title>' +
              '<body style="background:#0B0B0F;color:#fff;font:16px system-ui;padding:24px">' +
              '<h1>Pas de connexion</h1><p>Reviens quand le réseau est revenu.</p>',
            { headers: { 'content-type': 'text/html; charset=utf-8' }, status: 503 },
          );
        }
      })(),
    );
  }
});

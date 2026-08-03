'use client';

import { useEffect, useState } from 'react';
import { browserSupabase, hasBrowserSupabase } from '@/lib/supabase/client';

/**
 * Établit la session quand Supabase renvoie les jetons dans le FRAGMENT d'URL.
 *
 * POURQUOI CE COMPOSANT EXISTE
 *
 * Supabase dispose de deux flux de retour d'authentification :
 *
 *   · PKCE     → `?code=...`            lisible par le serveur
 *   · implicite → `#access_token=...`   fragment, JAMAIS transmis au serveur
 *
 * `/auth/callback` est une route serveur : elle ne peut lire que le premier.
 * Face au second, elle ne trouve aucun code, conclut « lien invalide » et
 * renvoie l'utilisateur vers /compte sans session. Résultat observé en
 * production : des comptes créés, des crédits achetés, et pas une seule
 * connexion réussie — sans le moindre message d'erreur exploitable.
 *
 * Un fragment n'étant lisible que côté navigateur, le rattraper EXIGE du code
 * client. C'est le rôle de ce composant : il complète `/auth/callback` au lieu
 * de le remplacer, et les deux flux fonctionnent désormais.
 *
 * Monté dans le layout racine, parce que Supabase peut retomber sur n'importe
 * quelle page quand l'URL demandée n'est pas dans sa liste blanche.
 */

/** Mêmes destinations autorisées que dans `/auth/callback`. */
function isAllowed(destination: string): boolean {
  if (['/creer', '/compte', '/credits', '/'].includes(destination)) return true;
  return /^\/creer\/[a-z0-9-]{1,60}$/.test(destination);
}

export function AuthFragmentHandler() {
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (!hasBrowserSupabase()) return;

    const hash = window.location.hash;
    if (!hash.includes('access_token=')) return;

    const params = new URLSearchParams(hash.slice(1));
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');

    // Supabase peut aussi renvoyer une erreur dans le fragment.
    const fragmentError = params.get('error_description') ?? params.get('error');
    if (fragmentError) {
      console.error('[auth] Erreur renvoyée dans le fragment :', fragmentError);
      window.location.replace('/compte?erreur=lien-expire');
      return;
    }

    if (!access_token || !refresh_token) return;

    setWorking(true);

    void (async () => {
      const { error } = await browserSupabase().auth.setSession({
        access_token,
        refresh_token,
      });

      if (error) {
        console.error('[auth] setSession :', error.message);
        window.location.replace('/compte?erreur=lien-expire');
        return;
      }

      // Destination : `?next=` s'il est présent et autorisé, sinon le compte.
      const requested = new URLSearchParams(window.location.search).get('next');
      const destination = requested && isAllowed(requested) ? requested : '/compte';

      // `replace` et non `assign` : les jetons ne doivent pas rester dans
      // l'historique de navigation, où ils resteraient lisibles.
      window.location.replace(destination);
    })();
  }, []);

  if (!working) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink"
      role="status"
      aria-live="polite"
    >
      <p className="text-base text-muted">Connexion en cours…</p>
    </div>
  );
}

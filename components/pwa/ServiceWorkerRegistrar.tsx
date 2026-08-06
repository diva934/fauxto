'use client';

import { useEffect } from 'react';

/**
 * Enregistre le service worker.
 *
 * Sans enregistrement, `beforeinstallprompt` n'est jamais émis par Chrome et
 * `InstallPrompt` reste du code mort sur Android. C'est la seule raison d'être
 * de ce composant : le service worker lui-même ne met en cache que les
 * fichiers de build, jamais les API ni les images générées.
 *
 * L'enregistrement est différé après le chargement : le faire pendant la
 * navigation initiale entrerait en concurrence avec le rendu de la page, sur
 * un produit dont l'essentiel du trafic arrive par un lien mobile.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
        // Un échec d'enregistrement ne casse rien : le site fonctionne à
        // l'identique, seule l'invitation à installer disparaît.
        console.warn('[pwa] Service worker non enregistré :', error);
      });
    };

    if (document.readyState === 'complete') {
      register();
      return;
    }

    window.addEventListener('load', register, { once: true });
    return () => window.removeEventListener('load', register);
  }, []);

  return null;
}

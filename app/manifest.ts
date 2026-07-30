import type { MetadataRoute } from 'next';
import { BRAND } from '@/lib/utils';

/**
 * Manifeste PWA — §6.1.
 *
 * `start_url` porte `?source=pwa` pour distinguer, dans les statistiques, les
 * lancements depuis l'écran d'accueil des visites navigateur. C'est la seule
 * mesure fiable du taux d'installation réel.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${BRAND.name} — ${BRAND.tagline}`,
    short_name: BRAND.name,
    description:
      'Transforme la photo de ton pote en canular crédible avec l’IA. 1 € la photo.',
    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0B0B0F',
    theme_color: '#0B0B0F',
    lang: 'fr-FR',
    dir: 'ltr',
    categories: ['entertainment', 'photo'],
    icons: [
      { src: '/icons/192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icons/maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Piéger un pote',
        short_name: 'Nouveau prank',
        url: '/creer?source=pwa-shortcut',
      },
    ],
  };
}

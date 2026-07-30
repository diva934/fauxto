import type { MetadataRoute } from 'next';
import { serverEnv } from '@/lib/env';

export default function robots(): MetadataRoute.Robots {
  const base = serverEnv.siteUrl;

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          // Tunnel de conversion et pages de compte : aucun intérêt en index,
          // et /creer/[template] duplique le contenu de /prank/[slug].
          '/creer/',
          '/credits',
          '/credits/',
          '/compte',
          '/auth/',
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}

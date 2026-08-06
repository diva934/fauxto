import type { MetadataRoute } from 'next';
import { serverEnv } from '@/lib/env';
import { TEMPLATES } from '@/lib/templates';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = serverEnv.siteUrl;
  const now = new Date();

  return [
    { url: base, lastModified: now, changeFrequency: 'daily', priority: 1 },
    {
      url: `${base}/creer`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    // Dix pages indexables plutôt qu'une : chaque prank a sa requête.
    ...TEMPLATES.map((template) => ({
      url: `${base}/prank/${template.slug}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
    // Indexable volontairement : c'est par la recherche que les créateurs
    // trouvent ce genre de page, pas par le pied de page du site.
    {
      url: `${base}/partenaire`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${base}/mentions-legales`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.2,
    },
    {
      url: `${base}/confidentialite`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    { url: `${base}/cgv`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/cgu`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    {
      url: `${base}/signaler`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.4,
    },
  ];
}

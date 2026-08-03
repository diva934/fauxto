import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import { AuthFragmentHandler } from '@/components/account/AuthFragmentHandler';
import { IosSplashLinks } from '@/components/pwa/IosSplashLinks';
import { BRAND } from '@/lib/utils';
import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'http://localhost:3000');

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${BRAND.name} — ${BRAND.tagline}`,
    template: `%s — ${BRAND.name}`,
  },
  description:
    'Transforme n’importe quelle photo en canular crédible avec l’IA. Voiture rayée, coupe ratée, vieilli de 40 ans. 1 € la photo, sans abonnement.',
  applicationName: BRAND.name,
  appleWebApp: {
    capable: true,
    title: BRAND.name,
    statusBarStyle: 'black-translucent',
  },
  formatDetection: { telephone: false },
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    siteName: BRAND.name,
    title: `${BRAND.name} — ${BRAND.tagline}`,
    description:
      'Transforme n’importe quelle photo en canular crédible avec l’IA. 1 € la photo, sans abonnement.',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${BRAND.name} — ${BRAND.tagline}`,
    description: 'Transforme n’importe quelle photo en canular crédible avec l’IA.',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#0B0B0F',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  // On autorise le zoom : le bloquer est une faute d'accessibilité, et ça ne
  // protège de rien puisque le texte est déjà dimensionné pour le mobile.
  maximumScale: 5,
  userScalable: true,
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: BRAND.name,
  applicationCategory: 'MultimediaApplication',
  operatingSystem: 'Web, iOS, Android',
  inLanguage: 'fr-FR',
  description:
    'Générateur de photos canular par intelligence artificielle. Modifie la photo d’un proche en quelques secondes.',
  offers: {
    '@type': 'AggregateOffer',
    priceCurrency: 'EUR',
    lowPrice: '2.99',
    highPrice: '14.99',
    offerCount: 3,
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const plausibleDomain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;

  return (
    <html lang="fr" className={`${inter.variable} h-full antialiased`}>
      <head>
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
        <link rel="icon" href="/icons/favicon.svg" type="image/svg+xml" />
        <link rel="manifest" href="/manifest.webmanifest" />
        {/* Sans ces images, la PWA installée démarre sur un écran blanc (§6.4). */}
        <IosSplashLinks />
        <script
          type="application/ld+json"
          // Données structurées statiques, aucune entrée utilisateur : pas de
          // surface d'injection ici.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-ink text-text">
        {/* Rattrape les jetons d'authentification renvoyés dans le fragment
            d'URL, que le serveur ne peut pas lire. Monté ici parce que Supabase
            peut retomber sur n'importe quelle page. */}
        <AuthFragmentHandler />
        {children}
        {/* Plausible : aucun cookie, donc aucun bandeau à afficher. */}
        {plausibleDomain ? (
          <Script
            defer
            data-domain={plausibleDomain}
            src="https://plausible.io/js/script.js"
            strategy="afterInteractive"
          />
        ) : null}
      </body>
    </html>
  );
}

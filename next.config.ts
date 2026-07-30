import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // `sharp` et `c2pa-node` embarquent des binaires natifs : ils doivent rester
  // externes au bundle serveur, sinon Turbopack tente de les tracer et échoue.
  serverExternalPackages: ['sharp', 'c2pa-node'],

  // Le produit est mobile-first et les images sont servies depuis Supabase
  // Storage. On n'autorise aucun autre hôte distant.
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            // La capture photo passe par <input capture>, pas par getUserMedia :
            // on peut donc refuser l'accès direct à la caméra.
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;

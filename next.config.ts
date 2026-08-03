import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // `sharp` et `c2pa-node` embarquent des binaires natifs : ils doivent rester
  // externes au bundle serveur, sinon Turbopack tente de les tracer et échoue.
  serverExternalPackages: ['sharp', 'c2pa-node'],

  /**
   * Force l'inclusion des binaires de `sharp` dans les fonctions déployées.
   *
   * Le traçage de fichiers de Next suit les `import` et les `require`. Or
   * `sharp` charge `libvips` par un chemin natif inscrit dans le binaire
   * `.node`, jamais par un `import` : le traçage ne peut pas le voir. Le
   * `.node` partait donc seul, sans la bibliothèque qu'il ouvre, et la fonction
   * échouait au chargement :
   *
   *   ERR_DLOPEN_FAILED: libvips-cpp.so.8.18.3: cannot open shared object file
   *
   * Rien ne le révèle en local sous Windows, où le binaire est complet et où
   * aucun traçage n'a lieu.
   */
  outputFileTracingIncludes: {
    '/api/**/*': ['./node_modules/@img/**/*'],
  },

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

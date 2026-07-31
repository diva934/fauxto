import 'server-only';

/**
 * Accès typé aux variables d'environnement serveur.
 *
 * La validation est *paresseuse* : elle se déclenche à l'appel, jamais au
 * chargement du module. C'est volontaire — `next build` doit passer sur une
 * machine qui n'a aucune clé configurée, et une route qui n'utilise pas Stripe
 * ne doit pas exploser parce que Stripe n'est pas configuré.
 */

class MissingEnvError extends Error {
  constructor(name: string) {
    super(
      `Variable d'environnement manquante : ${name}. ` +
        `Copie .env.example vers .env.local et renseigne-la.`,
    );
    this.name = 'MissingEnvError';
  }
}

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') throw new MissingEnvError(name);
  return value;
}

function optional(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() !== '' ? value : undefined;
}

export const serverEnv = {
  get siteUrl(): string {
    return (
      optional('NEXT_PUBLIC_SITE_URL') ??
      (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : 'http://localhost:3000')
    );
  },
  get geminiApiKey(): string {
    return required('GEMINI_API_KEY');
  },
  get supabaseUrl(): string {
    return required('NEXT_PUBLIC_SUPABASE_URL');
  },
  get supabaseAnonKey(): string {
    return required('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  },
  get supabaseServiceRoleKey(): string {
    return required('SUPABASE_SERVICE_ROLE_KEY');
  },
  get stripeSecretKey(): string {
    return required('STRIPE_SECRET_KEY');
  },
  get stripeWebhookSecret(): string {
    return required('STRIPE_WEBHOOK_SECRET');
  },
  get upstashUrl(): string | undefined {
    return optional('UPSTASH_REDIS_REST_URL');
  },
  get upstashToken(): string | undefined {
    return optional('UPSTASH_REDIS_REST_TOKEN');
  },
  get fingerprintSalt(): string {
    return required('FINGERPRINT_SALT');
  },
  get cronSecret(): string {
    return required('CRON_SECRET');
  },
  /** Certificat C2PA de production (PEM). Absent = signature de test. */
  get c2paCertPem(): string | undefined {
    return optional('C2PA_CERT_PEM');
  },
  get c2paKeyPem(): string | undefined {
    return optional('C2PA_PRIVATE_KEY_PEM');
  },
  get reportEmail(): string {
    // Pas de repli sur une adresse inventée : une adresse de contact qui
    // n'existe pas est pire que pas d'adresse du tout sur une page qui promet
    // de traiter les signalements. `<ToComplete />` rend l'absence visible.
    return optional('REPORT_CONTACT_EMAIL') ?? optional('NEXT_PUBLIC_CONTACT_EMAIL') ?? '';
  },
} as const;

/** Vrai si Upstash est configuré. Sans lui, on retombe sur un compteur en mémoire. */
export function hasRedis(): boolean {
  return Boolean(serverEnv.upstashUrl && serverEnv.upstashToken);
}

/** Vrai si Supabase est configuré (Phases 4+). */
export function hasSupabase(): boolean {
  return Boolean(
    optional('NEXT_PUBLIC_SUPABASE_URL') && optional('SUPABASE_SERVICE_ROLE_KEY'),
  );
}

/** Vrai si Stripe est configuré (Phase 5). */
export function hasStripe(): boolean {
  return Boolean(optional('STRIPE_SECRET_KEY'));
}

export { MissingEnvError };

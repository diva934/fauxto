/**
 * Identité de l'éditeur, à compléter avant la mise en production.
 *
 * ⚠️ Ces valeurs sont volontairement laissées à compléter. Elles ne peuvent pas
 * être inventées : un numéro SIRET ou une adresse fictifs sur des mentions
 * légales constituent une fausse déclaration, et rendraient les pages non
 * conformes tout en exposant l'éditeur.
 *
 * Renseigne-les via les variables d'environnement (voir .env.example) ou
 * directement ici. Le composant `<ToComplete />` affiche visiblement tout champ
 * manquant, pour qu'aucun oubli ne passe en production sans se voir.
 */

function fromEnv(name: string): string | null {
  const value = process.env[name];
  return value && value.trim() !== '' ? value.trim() : null;
}

export const LEGAL_ENTITY = {
  /** Raison sociale ou nom et prénom si entrepreneur individuel. */
  companyName: fromEnv('NEXT_PUBLIC_LEGAL_COMPANY_NAME'),
  /** Forme juridique : SASU, EURL, micro-entreprise… */
  legalForm: fromEnv('NEXT_PUBLIC_LEGAL_FORM'),
  /** Adresse du siège social, complète. */
  address: fromEnv('NEXT_PUBLIC_LEGAL_ADDRESS'),
  siret: fromEnv('NEXT_PUBLIC_LEGAL_SIRET'),
  /** Numéro de TVA intracommunautaire, si assujetti. */
  vatNumber: fromEnv('NEXT_PUBLIC_LEGAL_VAT'),
  /** Nom du responsable de la publication. */
  publisher: fromEnv('NEXT_PUBLIC_LEGAL_PUBLISHER'),
  /** Adresse de contact réelle — obligatoire, y compris pour les signalements. */
  contactEmail: fromEnv('NEXT_PUBLIC_CONTACT_EMAIL'),
  /** Hébergeur. Prérempli car imposé par le choix de plateforme. */
  host: 'Vercel Inc., 340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis',
  hostContact: 'https://vercel.com',
} as const;

export const LAST_UPDATED = '29 juillet 2026';

/** Sous-traitants à nommer explicitement dans la politique de confidentialité. */
export const SUBPROCESSORS = [
  {
    name: 'Google Ireland Limited (API Gemini)',
    purpose:
      'Génération et analyse des images. Les photos envoyées lui sont transmises pour traitement.',
    location: 'Union européenne et États-Unis',
    safeguard: 'Clauses contractuelles types (CCT) et Data Privacy Framework',
  },
  {
    name: 'Supabase Inc.',
    purpose: 'Hébergement de la base de données, de l’authentification et du stockage des images.',
    location: 'Union européenne (région choisie à la création du projet)',
    safeguard: 'Clauses contractuelles types (CCT)',
  },
  {
    name: 'Vercel Inc.',
    purpose: 'Hébergement de l’application et journaux techniques.',
    location: 'États-Unis, avec diffusion par CDN',
    safeguard: 'Clauses contractuelles types (CCT) et Data Privacy Framework',
  },
  {
    name: 'Stripe Payments Europe, Ltd.',
    purpose:
      'Traitement des paiements. Aucune donnée bancaire ne transite par nos serveurs.',
    location: 'Union européenne',
    safeguard: 'Responsable de traitement autonome pour les données de paiement',
  },
  {
    name: 'Upstash, Inc.',
    purpose: 'Limitation du débit des requêtes (anti-abus). Ne stocke que des empreintes techniques.',
    location: 'Union européenne',
    safeguard: 'Clauses contractuelles types (CCT)',
  },
] as const;

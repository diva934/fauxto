import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Nom de domaine affiché, notamment dans le texte de partage.
 *
 * Il est DÉRIVÉ de `NEXT_PUBLIC_SITE_URL`, jamais écrit en dur. Il l'était
 * auparavant (`fauxto.com`), un domaine qui n'appartenait pas au projet : le
 * message de partage WhatsApp envoyait donc chaque destinataire chez un tiers.
 * Une valeur codée en dur ici finit toujours par diverger du domaine réel, et
 * l'erreur est invisible depuis l'interface.
 *
 * Changer de domaine ne demande donc que de mettre `NEXT_PUBLIC_SITE_URL` à
 * jour dans Vercel — aucun déploiement de code.
 */
function siteDomain(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return 'fauxto.vercel.app';
  try {
    return new URL(raw).host;
  } catch {
    // URL malformée : on retombe sur le domaine de déploiement plutôt que
    // d'afficher une chaîne cassée dans un message que l'utilisateur envoie.
    return 'fauxto.vercel.app';
  }
}

export const BRAND = {
  name: 'Fauxto',
  domain: siteDomain(),
  // Alimente le <title> par défaut de toutes les pages : doit rester aligné
  // sur le H1 de l'accueil, sinon l'onglet et la page racontent deux choses.
  tagline: 'Fais douter n’importe qui',
} as const;

/** Formatte un entier à la française : 12483 -> « 12 483 ». */
export function formatCount(value: number): string {
  return new Intl.NumberFormat('fr-FR').format(value);
}

/** Formatte un prix en euros : 2.99 -> « 2,99 € ». */
export function formatPrice(euros: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(euros);
}

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Nom de domaine affiché et incrusté en filigrane. */
export const BRAND = {
  name: 'Fauxto',
  domain: 'fauxto.com',
  tagline: 'Piège tes potes en une photo',
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

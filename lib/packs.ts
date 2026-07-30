/**
 * Packs de crédits — paiement unique, jamais d'abonnement.
 *
 * Le churn d'un abonnement sur un produit à usage ponctuel est catastrophique :
 * personne ne piège ses amis chaque semaine. On vend donc des crédits, et on
 * écrit noir sur blanc qu'ils n'expirent pas — ça enlève l'objection principale.
 *
 * Note d'économie, utile pour comprendre l'écart entre l'unité et les packs :
 * Stripe prélève environ 1,5 % + 0,25 € par transaction européenne. Sur une
 * vente à 1 €, cela représente plus d'un quart de la recette, avant même le
 * coût de génération. Le pack à 1 crédit est donc un produit d'appel, pas une
 * source de marge : l'écart de prix unitaire (1,00 € contre 0,50 €) est là pour
 * rendre la remontée vers les packs évidente dès le premier achat.
 */

export interface CreditPack {
  id: string;
  credits: number;
  priceEuros: number;
  /** Montant en centimes, seule valeur transmise à Stripe. */
  priceCents: number;
  labelFr: string;
  highlight: boolean;
  badgeFr?: string;
  /** Argument affiché sous le prix. */
  hintFr?: string;
}

export const PACKS: readonly CreditPack[] = [
  {
    id: 'pack-1',
    credits: 1,
    priceEuros: 1,
    priceCents: 100,
    labelFr: '1 prank',
    highlight: false,
    hintFr: 'Pour essayer',
  },
  {
    id: 'pack-5',
    credits: 5,
    priceEuros: 3.99,
    priceCents: 399,
    labelFr: '5 pranks',
    highlight: false,
    hintFr: '−20 %',
  },
  {
    id: 'pack-15',
    credits: 15,
    priceEuros: 8.99,
    priceCents: 899,
    labelFr: '15 pranks',
    highlight: true,
    badgeFr: 'Le plus populaire',
    hintFr: '−40 %',
  },
  {
    id: 'pack-40',
    credits: 40,
    priceEuros: 19.99,
    priceCents: 1999,
    labelFr: '40 pranks',
    highlight: false,
    hintFr: '−50 %',
  },
] as const;

const BY_ID = new Map(PACKS.map((pack) => [pack.id, pack]));

export function getPack(id: string): CreditPack | undefined {
  return BY_ID.get(id);
}

/** Prix unitaire, pour afficher l'économie réalisée. */
export function pricePerPrank(pack: CreditPack): number {
  return pack.priceCents / pack.credits / 100;
}

/** Pack proposé par défaut quand l'utilisateur arrive sans crédits. */
export const ENTRY_PACK = PACKS[0];

/**
 * Packs de crédits — paiement unique, jamais d'abonnement.
 *
 * Le churn d'un abonnement sur un produit à usage ponctuel est catastrophique :
 * personne ne piège ses amis chaque semaine. On vend donc des crédits, et on
 * écrit noir sur blanc qu'ils n'expirent pas — ça enlève l'objection principale.
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
}

export const PACKS: readonly CreditPack[] = [
  {
    id: 'pack-3',
    credits: 3,
    priceEuros: 2.99,
    priceCents: 299,
    labelFr: '3 pranks',
    highlight: false,
  },
  {
    id: 'pack-10',
    credits: 10,
    priceEuros: 6.99,
    priceCents: 699,
    labelFr: '10 pranks',
    highlight: true,
    badgeFr: 'Le plus populaire',
  },
  {
    id: 'pack-30',
    credits: 30,
    priceEuros: 14.99,
    priceCents: 1499,
    labelFr: '30 pranks',
    highlight: false,
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

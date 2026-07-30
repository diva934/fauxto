import { Infinity as InfinityIcon, ShieldCheck, Zap } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PackPicker } from '@/components/funnel/PackPicker';
import { getCredits } from '@/lib/credits';
import { currentUser } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Recharger',
  description:
    'Packs de crédits à partir de 2,99 €. Paiement unique, pas d’abonnement, crédits sans expiration.',
  robots: { index: false, follow: true },
};

export const dynamic = 'force-dynamic';

export default async function CreditsPage() {
  const user = await currentUser();
  const credits = user ? await getCredits(user.id) : 0;

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 safe-top safe-bottom">
      <header className="py-4">
        <Link
          href="/creer"
          className="inline-flex min-h-touch items-center text-sm text-muted hover:text-text"
        >
          ← Retour
        </Link>
        <h1 className="mt-1 text-3xl font-extrabold leading-tight tracking-tight">
          {credits > 0 ? 'Recharge tes pranks' : 'Continue à piéger tes potes'}
        </h1>
        <p className="mt-2 text-base text-muted">
          {credits > 0 ? (
            <>
              Il te reste{' '}
              <span className="font-semibold text-text">{credits}</span>{' '}
              {credits > 1 ? 'crédits' : 'crédit'}.
            </>
          ) : (
            <>Ta photo offerte est passée. La suite est sans filigrane.</>
          )}
        </p>
      </header>

      <PackPicker knownEmail={user?.email ?? null} />

      <ul className="mt-6 space-y-3 rounded-card border border-line bg-surface p-4">
        <li className="flex items-start gap-3 text-sm">
          <InfinityIcon className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
          <span>
            <strong className="text-text">Les crédits n’expirent jamais.</strong>{' '}
            Utilise-les dans six mois si tu veux.
          </span>
        </li>
        <li className="flex items-start gap-3 text-sm">
          <Zap className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
          <span>
            <strong className="text-text">Plus de filigrane.</strong> Le nom de
            domaine disparaît de tes images.
          </span>
        </li>
        <li className="flex items-start gap-3 text-sm">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
          <span>
            <strong className="text-text">Une génération ratée ne coûte rien.</strong>{' '}
            Le crédit t’est rendu automatiquement.
          </span>
        </li>
      </ul>

      <p className="mt-4 pb-6 text-center text-xs leading-relaxed text-muted">
        La mention «&nbsp;Image générée par IA&nbsp;» reste présente sur toutes les
        images, y compris payantes : c’est une obligation légale, pas une option.
        <br />
        <Link href="/cgv" className="underline hover:text-text">
          Conditions de vente
        </Link>
      </p>
    </main>
  );
}

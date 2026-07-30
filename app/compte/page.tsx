import { Coins, Download } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { DeleteAccount } from '@/components/account/DeleteAccount';
import { SignInForm } from '@/components/account/SignInForm';
import { Button } from '@/components/ui/button';
import { getCredits } from '@/lib/credits';
import { currentUser } from '@/lib/supabase/server';
import { formatCount } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Mon compte',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const ERRORS: Record<string, string> = {
  'lien-invalide': 'Ce lien est incomplet. Demande-en un nouveau.',
  'lien-expire': 'Ce lien a expiré. Demande-en un nouveau.',
};

export default async function ComptePage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string }>;
}) {
  const { erreur } = await searchParams;
  const user = await currentUser();
  const credits = user ? await getCredits(user.id) : 0;

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 safe-top safe-bottom">
      <header className="py-4">
        <Link
          href="/"
          className="inline-flex min-h-touch items-center text-sm text-muted hover:text-text"
        >
          ← Retour
        </Link>
        <h1 className="mt-1 text-3xl font-extrabold leading-tight tracking-tight">
          Mon compte
        </h1>
      </header>

      {erreur && ERRORS[erreur] ? (
        <p className="mb-4 rounded-card bg-danger/10 p-3 text-sm text-danger" role="alert">
          {ERRORS[erreur]}
        </p>
      ) : null}

      {!user ? (
        <>
          <p className="mb-5 text-base leading-snug text-muted">
            Connecte-toi pour retrouver tes crédits sur n’importe quel appareil.
          </p>
          <SignInForm />
        </>
      ) : (
        <div className="space-y-4">
          <div className="bg-glass rounded-card p-5">
            <p className="text-sm text-muted">{user.email}</p>
            <p className="mt-3 flex items-baseline gap-2">
              <Coins className="size-6 self-center text-accent-strong" aria-hidden />
              <span className="text-4xl font-extrabold tabular-nums">
                {formatCount(credits)}
              </span>
              <span className="text-base text-muted">
                {credits > 1 ? 'crédits' : 'crédit'}
              </span>
            </p>
            <p className="mt-1 text-xs text-muted">
              Ils n’expirent pas. Jamais.
            </p>

            <div className="mt-4 space-y-2">
              <Button asChild block size="lg">
                <Link href={credits > 0 ? '/creer' : '/credits'}>
                  {credits > 0 ? 'Piéger un pote' : 'Recharger'}
                </Link>
              </Button>
              {credits > 0 ? (
                <Button asChild variant="ghost" block size="md">
                  <Link href="/credits">Ajouter des crédits</Link>
                </Button>
              ) : null}
            </div>
          </div>

          <div className="rounded-card border border-line bg-surface p-4">
            <h2 className="flex items-center gap-2 text-base font-bold">
              <Download className="size-4 text-muted" aria-hidden />
              Tes images
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              On ne garde aucune image plus de 24&nbsp;heures — c’est une
              obligation, pas un choix de stockage. Il n’y a donc pas de galerie
              à consulter : télécharge ce que tu veux garder au moment où tu le
              génères.
            </p>
          </div>

          <DeleteAccount credits={credits} />

          <p className="pt-2 text-center text-xs text-muted">
            <Link href="/confidentialite" className="underline hover:text-text">
              Comment tes données sont traitées
            </Link>
          </p>
        </div>
      )}
    </main>
  );
}

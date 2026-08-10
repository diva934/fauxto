import { Infinity as InfinityIcon, ShieldCheck, Zap } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SignInForm } from '@/components/account/SignInForm';
import { PackPicker } from '@/components/funnel/PackPicker';
import { ReferralCodeField } from '@/components/partner/ReferralCodeField';
import { getCredits } from '@/lib/credits';
import { currentUser } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Recharger',
  description:
    '1 € la photo à l’unité, dès 0,50 € par lot. Paiement unique, pas d’abonnement, crédits sans expiration.',
  robots: { index: false, follow: true },
};

export const dynamic = 'force-dynamic';

export default async function CreditsPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; paiement?: string }>;
}) {
  const { next, paiement } = await searchParams;
  const user = await currentUser();
  const credits = user ? await getCredits(user.id) : 0;

  const returnPath = next && /^\/creer\/[a-z0-9-]{1,60}$/.test(next) ? next : undefined;

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 safe-top safe-bottom">
      <header className="py-4">
        <Link
          href={returnPath ?? '/creer'}
          className="inline-flex min-h-touch items-center text-sm text-muted hover:text-text"
        >
          ← Retour
        </Link>
        <h1 className="mt-1 text-3xl font-extrabold leading-tight tracking-tight">
          {credits > 0
            ? 'Recharge tes pranks'
            : returnPath
              ? 'Plus qu’une étape'
              : 'Choisis ta formule'}
        </h1>
        <p className="mt-2 text-base text-muted">
          {credits > 0 ? (
            <>
              Il te reste{' '}
              <span className="font-semibold text-text">{credits}</span>{' '}
              {credits > 1 ? 'crédits' : 'crédit'}.
            </>
          ) : returnPath ? (
            <>Ta photo est gardée de côté. Choisis, paie, et elle se génère.</>
          ) : (
            <>À partir d’un euro l’unité. Moins cher par lot.</>
          )}
        </p>
      </header>

      {paiement === 'annule' ? (
        <p className="mb-4 rounded-card bg-surface-2 p-3 text-sm text-muted" role="status">
          Paiement annulé — rien ne t’a été débité. Ta photo est toujours là.
        </p>
      ) : null}

      {/* Le paiement exige une session : sans compte, proposer les packs
          enverrait l'utilisateur vers un 401 après avoir choisi. On demande
          donc la connexion d'abord, en conservant sa destination. */}
      {user ? (
        <PackPicker knownEmail={user.email} next={returnPath} />
      ) : (
        <SignInForm next={returnPath} />
      )}

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
            <strong className="text-text">Aucun filigrane.</strong> Tes images
            sortent propres, quel que soit le pack.
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

      {/* Saisie du code créateur — ICI et pas ailleurs.
          Le cookie d'attribution doit être posé AVANT l'ouverture de la session
          Stripe : c'est à ce moment que le code est recopié dans les
          métadonnées du paiement. Le placer après serait sans effet. */}
      <div className="mt-6">
        <ReferralCodeField />
      </div>

      <p className="mt-4 pb-6 text-center text-xs leading-relaxed text-muted">
        Les métadonnées de provenance restent présentes sur toutes les images, y
        compris payantes : c’est une obligation légale, pas une option. Aucune
        mention n’est visible sur l’image.
        <br />
        <Link href="/cgv" className="underline hover:text-text">
          Conditions de vente
        </Link>
      </p>
    </main>
  );
}

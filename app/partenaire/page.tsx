import { BarChart3, Euro, MousePointerClick, Users } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SignInForm } from '@/components/account/SignInForm';
import { JoinPartner } from '@/components/partner/JoinPartner';
import { serverEnv } from '@/lib/env';
import { DEFAULT_COMMISSION_RATE, formatEuros, getPartnerStats } from '@/lib/partners';
import { currentUser } from '@/lib/supabase/server';
import { BRAND } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Programme partenaire',
  description:
    'Partage Fauxto dans tes vidéos et touche une commission sur chaque vente venue de ton lien.',
  robots: { index: true, follow: true },
};

// Les chiffres doivent être ceux de l'instant : aucune mise en cache.
export const dynamic = 'force-dynamic';

function Stat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Euro;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-card border border-line bg-surface p-4">
      <p className="flex items-center gap-1.5 text-xs text-muted">
        <Icon className="size-3.5" aria-hidden />
        {label}
      </p>
      <p className="mt-1 text-2xl font-extrabold tabular-nums">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-muted">{hint}</p> : null}
    </div>
  );
}

export default async function PartenairePage() {
  const user = await currentUser();
  const stats = user ? await getPartnerStats(user.id) : null;
  const siteUrl = serverEnv.siteUrl;

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
          Programme partenaire
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Tu fais des vidéos ? Partage ton lien. Chaque vente qui en vient te
          rapporte une commission, et tu vois tes chiffres ici en temps réel.
        </p>
      </header>

      {!user ? (
        <section className="pb-8">
          <p className="mb-4 rounded-card border border-line bg-surface p-4 text-sm leading-relaxed text-muted">
            Connecte-toi pour obtenir ton lien. Le programme utilise le même
            compte que le site — rien de plus à créer.
          </p>
          <SignInForm next="/partenaire" />
        </section>
      ) : !stats ? (
        <section className="pb-8">
          <div className="mb-4 rounded-card border border-line bg-surface p-4">
            <h2 className="text-sm font-bold">Comment ça marche</h2>
            <ol className="mt-2 space-y-1.5 text-sm leading-relaxed text-muted">
              <li>1. Tu reçois un lien personnel du type {siteUrl}/tonpseudo.</li>
              <li>2. Tu le mets en description de tes vidéos.</li>
              <li>
                3. Chaque personne qui clique est rattachée à toi pendant 30
                jours, même si elle paie plus tard.
              </li>
              <li>
                4. Tu touches{' '}
                <strong className="text-text">
                  {Math.round(DEFAULT_COMMISSION_RATE * 100)} %
                </strong>{' '}
                de
                chaque paiement qu’elle fait.
              </li>
            </ol>
          </div>
          <JoinPartner siteUrl={siteUrl} />
        </section>
      ) : (
        <section className="pb-8">
          <div className="rounded-card border border-line bg-surface p-4">
            <p className="text-xs text-muted">Ton lien</p>
            <p className="mt-1 font-mono text-sm break-all">
              {siteUrl}/{stats.code}
            </p>
            <p className="mt-2 text-xs text-muted">
              Commission : {Math.round(stats.commission_rate * 100)} % de chaque
              paiement.
            </p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <Stat
              icon={MousePointerClick}
              label="Clics"
              value={String(stats.clicks)}
            />
            <Stat
              icon={Users}
              label="Visiteurs uniques"
              value={String(stats.unique_visitors)}
            />
            <Stat
              icon={BarChart3}
              label="Ont payé"
              value={String(stats.conversions)}
              hint={
                stats.clicks > 0
                  ? `${((stats.conversions / stats.clicks) * 100).toFixed(1)} % des clics`
                  : undefined
              }
            />
            <Stat
              icon={Euro}
              label="Ta commission"
              value={formatEuros(stats.commission_cents)}
              hint={`sur ${formatEuros(stats.revenue_cents)} encaissés`}
            />
          </div>

          <p className="mt-4 rounded-card border border-line bg-surface p-4 text-xs leading-relaxed text-muted">
            Les chiffres sont ceux de la base, sans arrondi ni estimation. Une
            vente n’est comptée qu’une fois le paiement confirmé par Stripe.
            Tes propres achats ne te rapportent rien.
          </p>
        </section>
      )}

      <section className="border-t border-line pb-8 pt-6">
        <h2 className="text-sm font-bold">Les règles</h2>
        <ul className="mt-2 space-y-2 text-xs leading-relaxed text-muted">
          <li>
            · Tu peux parler de {BRAND.name} comme tu veux, mais sans promettre
            un résultat « indétectable » ni laisser croire que les images sont
            réelles.
          </li>
          <li>
            · Pas d’achat de trafic, pas de spam, pas de faux comptes. Les
            commissions issues de clics artificiels ne sont pas versées.
          </li>
          <li>
            · Le versement se fait sur demande à partir de{' '}
            {formatEuros(2000)} de commission cumulée.
          </li>
        </ul>
      </section>
    </main>
  );
}

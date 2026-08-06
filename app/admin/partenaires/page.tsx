import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { serverEnv } from '@/lib/env';
import { formatEuros, getAllPartnerStats } from '@/lib/partners';
import { currentUser } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Partenaires',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * Tableau de bord exploitant : qui ramène du monde, et combien ça rapporte.
 *
 * ACCÈS. Réservé aux adresses listées dans `ADMIN_EMAILS`. Sans cette variable,
 * la page renvoie 404 — pas une erreur d'autorisation. Répondre « interdit »
 * confirmerait l'existence de la page à qui la cherche ; un 404 ne dit rien.
 *
 * La page n'expose aucune donnée d'acheteur : uniquement des agrégats par code.
 * Savoir QUI a acheté via un influenceur ne sert à rien ici et ferait circuler
 * des données personnelles sans motif.
 */

function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowed = process.env.ADMIN_EMAILS?.split(',').map((e) => e.trim().toLowerCase()) ?? [];
  return allowed.length > 0 && allowed.includes(email.toLowerCase());
}

export default async function AdminPartenairesPage() {
  const user = await currentUser();
  if (!isAdmin(user?.email)) notFound();

  const rows = (await getAllPartnerStats()) ?? [];
  const site = serverEnv.siteUrl.replace(/\/$/, '');

  const total = rows.reduce(
    (acc, r) => ({
      clicks: acc.clicks + r.clicks,
      conversions: acc.conversions + r.conversions,
      revenue: acc.revenue + r.revenueCents,
      commission: acc.commission + r.commissionCents,
    }),
    { clicks: 0, conversions: 0, revenue: 0, commission: 0 },
  );

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 safe-top safe-bottom">
      <header className="py-4">
        <Link
          href="/"
          className="inline-flex min-h-touch items-center text-sm text-muted hover:text-text"
        >
          ← Retour
        </Link>
        <h1 className="mt-1 text-3xl font-extrabold leading-tight tracking-tight">
          Partenaires
        </h1>
        <p className="mt-2 text-sm text-muted">
          Chiffres lus en base à l’instant. Une vente n’est comptée qu’une fois
          le paiement confirmé par Stripe.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Clics', value: String(total.clicks) },
          { label: 'Ventes', value: String(total.conversions) },
          { label: 'Encaissé', value: formatEuros(total.revenue) },
          { label: 'Commissions dues', value: formatEuros(total.commission) },
        ].map((stat) => (
          <div key={stat.label} className="rounded-card border border-line bg-surface p-4">
            <p className="text-xs text-muted">{stat.label}</p>
            <p className="mt-1 text-xl font-extrabold tabular-nums">{stat.value}</p>
          </div>
        ))}
      </section>

      <section className="mt-6 pb-8">
        {rows.length === 0 ? (
          <p className="rounded-card border border-line bg-surface p-4 text-sm text-muted">
            Aucun code pour le moment.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th className="py-2 pr-3 font-normal">Code</th>
                  <th className="py-2 pr-3 text-right font-normal">Clics</th>
                  <th className="py-2 pr-3 text-right font-normal">Ventes</th>
                  <th className="py-2 pr-3 text-right font-normal">Taux</th>
                  <th className="py-2 pr-3 text-right font-normal">Encaissé</th>
                  <th className="py-2 text-right font-normal">Dû</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.code} className="border-b border-line/50">
                    <td className="py-3 pr-3">
                      <span className="font-bold">{r.label}</span>
                      <span className="block font-mono text-[11px] text-muted">
                        {site}/r/{r.code}
                      </span>
                    </td>
                    <td className="py-3 pr-3 text-right tabular-nums">{r.clicks}</td>
                    <td className="py-3 pr-3 text-right tabular-nums">{r.conversions}</td>
                    <td className="py-3 pr-3 text-right tabular-nums text-muted">
                      {r.clicks > 0
                        ? `${((r.conversions / r.clicks) * 100).toFixed(1)} %`
                        : '—'}
                    </td>
                    <td className="py-3 pr-3 text-right tabular-nums">
                      {formatEuros(r.revenueCents)}
                    </td>
                    <td className="py-3 text-right tabular-nums">
                      {formatEuros(r.commissionCents)}
                      <span className="block text-[11px] text-muted">
                        {Math.round(r.commissionRate * 100)} %
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-4 text-xs leading-relaxed text-muted">
          Net pour toi : {formatEuros(total.revenue - total.commission)} — avant
          frais Stripe et TVA. Les commissions sont figées au moment de la vente :
          changer un taux ne recalcule pas le passé.
        </p>
      </section>
    </main>
  );
}

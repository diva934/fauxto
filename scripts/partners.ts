/**
 * Vue propriétaire du programme partenaire.
 *
 * Le tableau de bord de `/partenaire` est par partenaire : chacun ne voit que
 * ses propres chiffres, ce qui est voulu. Ce script donne la vue d'ensemble —
 * qui a été recruté, qui rapporte, et surtout combien vous devez.
 *
 * Usage :
 *   pnpm partners                       tous les partenaires, triés par commission
 *   pnpm partners --new=lea:Léa Dupont  crée le code « lea », étiqueté « Léa Dupont »
 *   pnpm partners --taux=0.30 --code=x  change le taux d'un partenaire
 */

import { DEFAULT_COMMISSION_RATE } from '../lib/partners';
import { serviceClient } from '../lib/supabase/service';

function arg(name: string): string | null {
  const found = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  return found ? found.split('=').slice(1).join('=').trim() : null;
}

function euros(cents: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(
    cents / 100,
  );
}

async function main(): Promise<void> {
  const sb = serviceClient();

  // ── Création d'un code, si demandée ───────────────────────────────────────
  // Format `code:Étiquette`. Le code est CHOISI et non dérivé : un influenceur
  // le lit à voix haute dans une vidéo, et le spectateur le tape de mémoire.
  const nouveau = arg('new');
  if (nouveau) {
    const [rawCode, ...rest] = nouveau.split(':');
    const code = rawCode.trim().toLowerCase();
    const label = rest.join(':').trim() || code;

    if (!/^[a-z0-9]{4,24}$/.test(code)) {
      console.log(
        `\n⚠️  « ${code} » n'est pas un code valide.` +
          `\n   Lettres minuscules et chiffres uniquement, 4 à 24 caractères.` +
          `\n   Pas d'accent ni de tiret : ça se tape mal depuis un téléphone.\n`,
      );
      process.exit(1);
    }

    const { data, error } = await sb.rpc('create_partner_code', {
      p_code: code,
      p_label: label,
      p_commission_rate: DEFAULT_COMMISSION_RATE,
    });

    if (error) {
      console.log(`\n❌ ${error.message}`);
      if (error.message.includes('create_partner_code')) {
        console.log('   La migration 0003_partner_codes_sans_compte.sql a-t-elle été appliquée ?');
      }
      process.exit(1);
    }

    const row = Array.isArray(data) ? data[0] : null;
    const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'https://fauxto.online';
    console.log(
      `\n${row?.created ? '✅ Code créé' : 'ℹ️  Code déjà existant'} : ${code} (${label})` +
        `\n🔗 ${site}/r/${code}\n`,
    );
  }

  // ── Changement de taux, si demandé ────────────────────────────────────────
  const newRate = arg('taux');
  const targetCode = arg('code');

  if (newRate || targetCode) {
    if (!newRate || !targetCode) {
      console.log('\n⚠️  --taux et --code vont ensemble.\n');
      process.exit(1);
    }
    const rate = Number(newRate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 1) {
      console.log('\n⚠️  Le taux est une fraction entre 0 et 1 (0.30 = 30 %).\n');
      process.exit(1);
    }

    const { error } = await sb
      .from('partners')
      .update({ commission_rate: rate })
      .eq('code', targetCode.toLowerCase());

    if (error) {
      console.log(`❌ ${error.message}`);
      process.exit(1);
    }
    console.log(
      `\n✅ ${targetCode} passe à ${Math.round(rate * 100)} %.` +
        `\n   Les commissions DÉJÀ enregistrées ne bougent pas : elles sont figées à la vente.\n`,
    );
  }

  // ── État des lieux ────────────────────────────────────────────────────────
  const { data: partners, error } = await sb
    .from('partners')
    .select('id, code, display_name, commission_rate, created_at')
    .order('created_at', { ascending: true });

  if (error) {
    console.log(`❌ Lecture impossible : ${error.message}`);
    console.log('   La migration 0002_partners.sql a-t-elle été appliquée ?');
    process.exit(1);
  }

  if (!partners?.length) {
    console.log('\n👥 Aucun partenaire pour le moment.\n');
    return;
  }

  const { data: clicks } = await sb.from('partner_clicks').select('partner_id');
  const { data: conversions } = await sb
    .from('partner_conversions')
    .select('partner_id, amount_cents, commission_cents');

  const clicksBy = new Map<string, number>();
  for (const row of clicks ?? []) {
    clicksBy.set(row.partner_id, (clicksBy.get(row.partner_id) ?? 0) + 1);
  }

  const salesBy = new Map<string, { n: number; revenue: number; commission: number }>();
  for (const row of conversions ?? []) {
    const current = salesBy.get(row.partner_id) ?? { n: 0, revenue: 0, commission: 0 };
    current.n += 1;
    current.revenue += row.amount_cents;
    current.commission += row.commission_cents;
    salesBy.set(row.partner_id, current);
  }

  const rows = partners
    .map((p) => ({
      code: p.code,
      name: p.display_name ?? '—',
      rate: p.commission_rate,
      clicks: clicksBy.get(p.id) ?? 0,
      ...(salesBy.get(p.id) ?? { n: 0, revenue: 0, commission: 0 }),
    }))
    .sort((a, b) => b.commission - a.commission);

  console.log(`\n👥 Partenaires : ${rows.length}\n`);
  for (const r of rows) {
    const conv = r.clicks > 0 ? `${((r.n / r.clicks) * 100).toFixed(1)} %` : '—';
    console.log(
      `   ${r.code.padEnd(18)} ${String(r.clicks).padStart(5)} clics · ` +
        `${String(r.n).padStart(4)} ventes (${conv.padStart(6)}) · ` +
        `CA ${euros(r.revenue).padStart(10)} · dû ${euros(r.commission).padStart(10)} ` +
        `(${Math.round(r.rate * 100)} %)`,
    );
  }

  const totals = rows.reduce(
    (acc, r) => ({
      clicks: acc.clicks + r.clicks,
      sales: acc.sales + r.n,
      revenue: acc.revenue + r.revenue,
      commission: acc.commission + r.commission,
    }),
    { clicks: 0, sales: 0, revenue: 0, commission: 0 },
  );

  console.log(
    `\n   TOTAL : ${totals.clicks} clics · ${totals.sales} ventes · ` +
      `CA ${euros(totals.revenue)} · commissions dues ${euros(totals.commission)}`,
  );
  console.log(
    `   Net pour toi : ${euros(totals.revenue - totals.commission)} ` +
      `(avant frais Stripe et TVA)\n`,
  );

  console.log('Créer un code   :  pnpm partners --new=lea:Léa Dupont');
  console.log('Changer un taux :  pnpm partners --code=lea --taux=0.30\n');
}

void main();

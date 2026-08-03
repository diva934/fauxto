/**
 * Exerce la chaîne serveur de /api/generate, étape par étape, avec le service
 * role — sans passer par HTTP ni par la session navigateur.
 *
 * But : distinguer une panne de la chaîne serveur (insertion, RPC, RLS) d'une
 * panne de session côté navigateur. Les deux produisent le même symptôme vu de
 * l'utilisateur — « ça ne marche pas » — mais n'ont rien à voir.
 *
 * Usage : pnpm probe --email=ton@adresse.fr
 */

import { serviceClient } from '../lib/supabase/service';

function arg(name: string): string | null {
  const found = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  return found ? found.split('=').slice(1).join('=').trim() : null;
}

let echecs = 0;

function check(label: string, ok: boolean, detail?: string): void {
  console.log(ok ? `  ✅ ${label}` : `  ❌ ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) echecs += 1;
}

async function main(): Promise<void> {
  const email = arg('email');
  if (!email) {
    console.log('\nUsage : pnpm probe --email=ton@adresse.fr\n');
    process.exit(1);
  }

  const sb = serviceClient();
  console.log('\n🔍 Chaîne serveur de /api/generate\n');

  // ── 1. Le compte existe ─────────────────────────────────────────────────
  const { data: users, error: usersError } = await sb.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  check('listUsers accessible', !usersError, usersError?.message);
  const user = users?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  check(`compte ${email} trouvé`, Boolean(user));
  if (!user) {
    process.exit(1);
  }

  // ── 2. Le profil existe (cree par le trigger on_auth_user_created) ──────
  const { data: profile, error: profileError } = await sb
    .from('profiles')
    .select('credits')
    .eq('id', user.id)
    .single();
  check('profil présent en base', !profileError && Boolean(profile), profileError?.message);
  console.log(`     solde actuel : ${profile?.credits ?? '?'}`);

  // ── 3. L'insertion dans generations fonctionne ───────────────────────────
  //     C'est exactement ce que fait createGenerationRow() dans la route.
  const { data: row, error: insertError } = await sb
    .from('generations')
    .insert({
      template_id: 'voiture-rayee',
      status: 'pending',
      user_id: user.id,
      anon_session_id: null,
      watermarked: false,
    })
    .select('id')
    .single();
  check('insertion dans generations', !insertError && Boolean(row), insertError?.message);

  // ── 4. La reservation de credit fonctionne ───────────────────────────────
  const { data: reserved, error: reserveError } = await sb.rpc('reserve_credit', {
    p_user_id: user.id,
  });
  check('reserve_credit exécutable', !reserveError, reserveError?.message);
  check('crédit effectivement réservé', reserved === true, `renvoyé : ${String(reserved)}`);

  // ── 5. Le remboursement fonctionne (on rend ce qu'on vient de prendre) ───
  if (reserved === true) {
    const { error: refundError } = await sb.rpc('refund_credit', {
      p_user_id: user.id,
      p_generation_id: row?.id ?? null,
      p_reason: 'sonde_diagnostic',
    });
    check('refund_credit exécutable', !refundError, refundError?.message);
  }

  // ── 6. Le bucket Storage accepte un dépôt ────────────────────────────────
  const octets = Buffer.from([255, 216, 255, 217]);
  const chemin = `sonde-${Date.now()}.jpg`;
  const { error: uploadError } = await sb.storage
    .from('generations')
    .upload(chemin, octets, { contentType: 'image/jpeg', upsert: true });
  check('dépôt dans le bucket', !uploadError, uploadError?.message);
  if (!uploadError) await sb.storage.from('generations').remove([chemin]);

  // ── Nettoyage de la ligne de sonde ───────────────────────────────────────
  if (row?.id) {
    await sb.from('generations').delete().eq('id', row.id);
  }

  // ── Solde final : doit etre identique au depart ──────────────────────────
  const { data: after } = await sb
    .from('profiles')
    .select('credits')
    .eq('id', user.id)
    .single();
  check(
    'solde inchangé après la sonde',
    after?.credits === profile?.credits,
    `avant ${profile?.credits} / après ${after?.credits}`,
  );

  console.log(
    echecs === 0
      ? '\n✅ La chaîne serveur est saine. Le blocage est donc côté navigateur :\n' +
          '   session non lue, ou l’interface n’appelle jamais l’API.\n'
      : `\n❌ ${echecs} maillon(s) en échec côté serveur.\n`,
  );
  process.exit(echecs === 0 ? 0 : 1);
}

void main();

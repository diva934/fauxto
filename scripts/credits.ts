/**
 * Inspection du tunnel et attribution manuelle de crédits.
 *
 * Deux usages :
 *
 *   pnpm credits                          état des comptes, crédits, générations
 *   pnpm credits --grant=5 --email=x@y.z  crédite un compte
 *
 * L'attribution manuelle n'est pas un contournement du paiement : elle sert à
 * tester le produit de bout en bout avant que Stripe soit branché, et ensuite à
 * traiter les gestes commerciaux (un client dont la génération a échoué d'une
 * façon que le remboursement automatique n'a pas couverte).
 *
 * Elle passe par `grant_credits`, la même fonction Postgres que le webhook
 * Stripe, avec un identifiant de session préfixé `manuel:` — donc l'opération
 * apparaît dans `credit_transactions` et reste traçable. Aucun chemin parallèle
 * qui contournerait la comptabilité.
 */

import { randomUUID } from 'node:crypto';
import { serviceClient } from '../lib/supabase/service';
import { hasStripe, hasSupabase } from '../lib/env';

interface Args {
  grant: number | null;
  email: string | null;
}

function parseArgs(argv: string[]): Args {
  const flags = new Map(
    argv
      .filter((a) => a.startsWith('--'))
      .map((a) => {
        const [k, ...rest] = a.replace(/^--/, '').split('=');
        return [k, rest.join('=')] as const;
      }),
  );
  const grant = flags.get('grant');
  return {
    grant: grant ? Number(grant) : null,
    email: flags.get('email')?.trim().toLowerCase() ?? null,
  };
}

async function inspect(): Promise<void> {
  const sb = serviceClient();

  const { data: users, error: usersError } = await sb.auth.admin.listUsers({
    page: 1,
    perPage: 50,
  });
  if (usersError) {
    console.log(`❌ listUsers : ${usersError.message}`);
    return;
  }

  console.log(`\n👤 Comptes : ${users.users.length}`);
  const { data: profiles } = await sb.from('profiles').select('id, credits');
  const byId = new Map((profiles ?? []).map((p) => [p.id, p.credits]));

  for (const u of users.users) {
    const credits = byId.get(u.id);
    console.log(
      `   ${u.email ?? '(sans e-mail)'} — ${credits ?? 0} crédit(s)` +
        (credits === undefined ? '  ⚠️ aucun profil en base' : ''),
    );
  }
  if (users.users.length === 0) {
    console.log('   (aucun — personne ne peut donc générer)');
  }

  const { data: gens } = await sb
    .from('generations')
    .select('template_id, status, error_message, moderation_flag, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  console.log(`\n🖼️  Dernières générations : ${gens?.length ?? 0}`);
  for (const g of gens ?? []) {
    const quand = new Date(g.created_at).toLocaleString('fr-FR');
    console.log(
      `   ${quand} · ${g.template_id} · ${g.status}` +
        (g.moderation_flag ? ` [modération: ${g.moderation_flag}]` : '') +
        (g.error_message ? `\n      ↳ ${g.error_message.slice(0, 120)}` : ''),
    );
  }
  if (!gens || gens.length === 0) {
    console.log('   (aucune — le tunnel n’a jamais abouti jusqu’à la génération)');
  }

  const { data: tx } = await sb
    .from('credit_transactions')
    .select('delta, reason, created_at')
    .order('created_at', { ascending: false })
    .limit(8);
  console.log(`\n💳 Mouvements de crédits : ${tx?.length ?? 0}`);
  for (const t of tx ?? []) {
    console.log(`   ${t.delta > 0 ? '+' : ''}${t.delta} · ${t.reason}`);
  }

  console.log(
    `\n💰 Stripe : ${hasStripe() ? 'configuré' : '❌ NON CONFIGURÉ — aucun crédit ne peut être acheté'}`,
  );
}

async function grant(email: string, amount: number): Promise<void> {
  const sb = serviceClient();

  const { data: users, error } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) {
    console.log(`❌ listUsers : ${error.message}`);
    process.exit(1);
  }

  const user = users.users.find((u) => u.email?.toLowerCase() === email);
  if (!user) {
    console.log(`\n❌ Aucun compte pour ${email}.`);
    console.log('   Comptes existants :');
    for (const u of users.users) console.log(`     · ${u.email}`);
    console.log('\n   Crée d’abord le compte depuis /compte sur le site.\n');
    process.exit(1);
  }

  // Même fonction que le webhook Stripe : l'opération est tracée dans
  // credit_transactions et l'unicité empêche un double-crédit accidentel.
  const { data: granted, error: grantError } = await sb.rpc('grant_credits', {
    p_user_id: user.id,
    p_delta: amount,
    p_reason: 'attribution_manuelle',
    p_stripe_session_id: `manuel:${randomUUID()}`,
  });

  if (grantError) {
    console.log(`❌ grant_credits : ${grantError.message}`);
    process.exit(1);
  }
  if (granted === false) {
    console.log('❌ Rejeté par la contrainte d’unicité — réessaie.');
    process.exit(1);
  }

  const { data: profile } = await sb
    .from('profiles')
    .select('credits')
    .eq('id', user.id)
    .single();

  console.log(`\n✅ ${amount} crédit(s) accordé(s) à ${email}.`);
  console.log(`   Nouveau solde : ${profile?.credits ?? '?'}\n`);
}

async function main(): Promise<void> {
  if (!hasSupabase()) {
    console.log('\n❌ Supabase non configuré. Rien à inspecter.\n');
    process.exit(1);
  }

  const args = parseArgs(process.argv.slice(2));

  if (args.grant !== null) {
    if (!args.email) {
      console.log('\n❌ Précise le compte : --email=adresse@exemple.fr\n');
      process.exit(1);
    }
    if (!Number.isInteger(args.grant) || args.grant <= 0) {
      console.log('\n❌ --grant attend un entier positif.\n');
      process.exit(1);
    }
    await grant(args.email, args.grant);
    return;
  }

  await inspect();
  console.log('\nPour créditer un compte :');
  console.log('   pnpm credits --grant=5 --email=ton@adresse.fr\n');
}

void main();

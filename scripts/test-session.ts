/**
 * Fabrique un lien de connexion pour un compte de TEST, afin d'exercer le
 * parcours navigateur complet sans toucher au compte personnel du propriétaire.
 *
 * Usage : pnpm test:session --email=test@fauxto.test [--credits=3]
 *
 * Le lien produit est à usage unique et expire comme n'importe quel lien de
 * connexion. Il ne contourne rien : il emprunte le même mécanisme que celui
 * envoyé par e-mail, sans passer par la boîte mail.
 */

import { randomUUID } from 'node:crypto';
import { serverEnv } from '../lib/env';
import { serviceClient } from '../lib/supabase/service';

function arg(name: string): string | null {
  const found = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  return found ? found.split('=').slice(1).join('=').trim() : null;
}

async function main(): Promise<void> {
  const email = arg('email');
  if (!email) {
    console.log('\nUsage : pnpm test:session --email=test@fauxto.test [--credits=3]\n');
    process.exit(1);
  }
  const credits = Number(arg('credits') ?? 0);
  const sb = serviceClient();

  // Crée le compte s'il n'existe pas. Réservé aux adresses de test.
  const { data: users } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
  let user = users?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

  if (!user) {
    const { data: created, error } = await sb.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    if (error || !created.user) {
      console.log(`❌ createUser : ${error?.message}`);
      process.exit(1);
    }
    user = created.user;
    console.log(`✅ Compte de test créé : ${email}`);
  }

  if (credits > 0) {
    const { error } = await sb.rpc('grant_credits', {
      p_user_id: user.id,
      p_delta: credits,
      p_reason: 'test_session',
      p_stripe_session_id: `test:${randomUUID()}`,
    });
    if (error) console.log(`⚠️  grant_credits : ${error.message}`);
    else console.log(`✅ ${credits} crédit(s) accordé(s)`);
  }

  const { data: profile } = await sb
    .from('profiles')
    .select('credits')
    .eq('id', user.id)
    .single();
  console.log(`   solde : ${profile?.credits ?? 0}`);

  const { data: link, error: linkError } = await sb.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: `${serverEnv.siteUrl}/auth/callback?next=/creer` },
  });

  if (linkError || !link.properties?.action_link) {
    console.log(`❌ generateLink : ${linkError?.message}`);
    process.exit(1);
  }

  console.log(`\n🔗 Lien de connexion :\n${link.properties.action_link}\n`);
}

void main();

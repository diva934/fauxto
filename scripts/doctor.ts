/**
 * Diagnostic de mise en service.
 *
 * Répond à une seule question : « qu'est-ce qui manque pour que le produit
 * marche ? » — et surtout, vérifie ce qu'aucun autre test ne peut vérifier :
 * que les IDENTIFIANTS DE MODÈLE codés dans l'application existent réellement
 * côté Gemini. C'est le risque n°1 du projet : ces trois identifiants viennent
 * du cahier des charges, ils n'ont jamais été confrontés à l'API, et si l'un est
 * faux la génération échoue sans que rien d'autre ne le signale.
 *
 * Usage : pnpm doctor
 */

import { DEFAULT_MODEL, PRO_MODEL } from '../lib/image-engine/gemini';

const MODERATION_MODEL =
  process.env.GEMINI_MODERATION_MODEL?.trim() || 'gemini-3.1-flash';

type Severity = 'bloquant' | 'degrade' | 'optionnel';

interface Check {
  name: string;
  severity: Severity;
  /** Ce que perd le produit si c'est absent. */
  impact: string;
}

const ENV_CHECKS: Check[] = [
  {
    name: 'GEMINI_API_KEY',
    severity: 'bloquant',
    impact: 'aucune génération d’image possible — le produit ne fait rien',
  },
  {
    name: 'FINGERPRINT_SALT',
    severity: 'bloquant',
    impact:
      '/api/generate renvoie 500 : sans sel, impossible d’identifier un visiteur sans stocker son IP',
  },
  {
    name: 'NEXT_PUBLIC_SITE_URL',
    severity: 'degrade',
    impact: 'sitemap, images Open Graph et redirections Stripe pointeront vers localhost',
  },
  {
    name: 'NEXT_PUBLIC_SUPABASE_URL',
    severity: 'degrade',
    impact: 'pas de base : le quota gratuit ne survit pas à un redémarrage',
  },
  {
    name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    severity: 'degrade',
    impact: 'connexion utilisateur impossible',
  },
  {
    name: 'SUPABASE_SERVICE_ROLE_KEY',
    severity: 'degrade',
    impact: 'pas de crédits, pas de purge 24 h, pas de signalements persistés',
  },
  {
    name: 'CRON_SECRET',
    severity: 'degrade',
    impact: 'la purge RGPD refuse de s’exécuter (401)',
  },
  {
    name: 'STRIPE_SECRET_KEY',
    severity: 'optionnel',
    impact: 'aucun achat possible — le produit reste en mode « une photo offerte »',
  },
  {
    name: 'STRIPE_WEBHOOK_SECRET',
    severity: 'optionnel',
    impact: 'les paiements aboutissent mais ne créditent jamais le compte',
  },
  {
    name: 'UPSTASH_REDIS_REST_URL',
    severity: 'optionnel',
    impact: 'limitation de débit en mémoire seulement — inopérante en serverless',
  },
  {
    name: 'UPSTASH_REDIS_REST_TOKEN',
    severity: 'optionnel',
    impact: 'idem',
  },
  {
    name: 'C2PA_CERT_PEM',
    severity: 'optionnel',
    impact:
      'les images sont signées avec le certificat de TEST : manifeste valide mais non approuvé par les vérificateurs',
  },
  {
    name: 'NEXT_PUBLIC_CONTACT_EMAIL',
    severity: 'degrade',
    impact: 'les pages légales affichent « [À COMPLÉTER] » en rouge',
  },
];

const SYMBOLS: Record<Severity, string> = {
  bloquant: '🔴',
  degrade: '🟠',
  optionnel: '⚪',
};

let blockers = 0;

function section(title: string): void {
  console.log(`\n${'─'.repeat(60)}\n${title}\n${'─'.repeat(60)}`);
}

function checkEnv(): void {
  section('1. Variables d’environnement');

  for (const check of ENV_CHECKS) {
    const raw = process.env[check.name];
    const present = Boolean(raw && raw.trim() !== '');

    if (present) {
      console.log(`  ✅ ${check.name}`);
      continue;
    }

    console.log(`  ${SYMBOLS[check.severity]} ${check.name} — absent`);
    console.log(`       ↳ ${check.impact}`);
    if (check.severity === 'bloquant') blockers += 1;
  }
}

/** Distance de Levenshtein, pour suggérer un identifiant proche. */
function distance(a: string, b: string): number {
  const matrix = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      matrix[i][j] =
        a[i - 1] === b[j - 1]
          ? matrix[i - 1][j - 1]
          : 1 + Math.min(matrix[i - 1][j], matrix[i][j - 1], matrix[i - 1][j - 1]);
    }
  }
  return matrix[a.length][b.length];
}

async function checkModels(): Promise<void> {
  section('2. Identifiants de modèle Gemini (le point le plus risqué)');

  if (!process.env.GEMINI_API_KEY) {
    console.log('  ⏭️  GEMINI_API_KEY absente — vérification impossible.');
    console.log(
      '       C’est LE contrôle qui compte : les trois identifiants ci-dessous\n' +
        '       viennent du cahier des charges et n’ont jamais été confrontés à l’API.',
    );
    console.log(`\n       · ${DEFAULT_MODEL}   (8 templates sur 10)`);
    console.log(`       · ${PRO_MODEL}     (chèque géant, une de magazine)`);
    console.log(`       · ${MODERATION_MODEL}       (modération, avant chaque génération)`);
    return;
  }

  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const available: string[] = [];
  try {
    const pager = await ai.models.list({ config: { queryBase: true, pageSize: 200 } });
    for await (const model of pager) {
      // L'API renvoie « models/xxx » ; l'application passe « xxx ».
      if (model.name) available.push(model.name.replace(/^models\//, ''));
    }
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    console.log(`  🔴 Impossible de lister les modèles : ${detail}`);
    console.log('       Clé invalide, révoquée, ou API non activée sur le projet.');
    blockers += 1;
    return;
  }

  console.log(`  ${available.length} modèles disponibles sur cette clé.\n`);

  const used = [
    { id: DEFAULT_MODEL, role: 'génération, 8 templates sur 10' },
    { id: PRO_MODEL, role: 'génération, chèque géant et une de magazine' },
    { id: MODERATION_MODEL, role: 'modération, avant CHAQUE génération' },
  ];

  for (const { id, role } of used) {
    if (available.includes(id)) {
      console.log(`  ✅ ${id}`);
      continue;
    }

    blockers += 1;
    console.log(`  🔴 ${id} — INTROUVABLE (${role})`);

    const suggestions = available
      .map((candidate) => ({ candidate, d: distance(id, candidate) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 4)
      .map((s) => s.candidate);
    console.log(`       ↳ candidats les plus proches : ${suggestions.join(', ')}`);
  }

  // Aide au diagnostic : montrer ce qui ressemble à un modèle d'image.
  const imageish = available.filter((m) => /image|imagen|banana/i.test(m));
  if (imageish.length > 0) {
    console.log(`\n  Modèles contenant « image » : ${imageish.join(', ')}`);
  }
}

async function checkSupabase(): Promise<void> {
  section('3. Supabase');

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.log('  ⏭️  Non configuré — crédits, purge 24 h et signalements inactifs.');
    return;
  }

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Vérifie que la migration a bien été appliquée : une clé valide sur un
  // projet vide donnerait un faux sentiment de sécurité.
  for (const table of ['profiles', 'anon_sessions', 'generations', 'credit_transactions', 'reports']) {
    const { error } = await supabase.from(table as never).select('*').limit(0);
    console.log(
      error ? `  🔴 table ${table} — ${error.message}` : `  ✅ table ${table}`,
    );
    if (error) blockers += 1;
  }

  for (const fn of ['weekly_generation_count']) {
    const { error } = await supabase.rpc(fn as never);
    console.log(error ? `  🔴 fonction ${fn}() — ${error.message}` : `  ✅ fonction ${fn}()`);
    if (error) blockers += 1;
  }

  const { error: bucketError } = await supabase.storage.getBucket('generations');
  console.log(
    bucketError
      ? `  🔴 bucket « generations » — ${bucketError.message}`
      : '  ✅ bucket « generations »',
  );
  if (bucketError) blockers += 1;
}

async function checkStripe(): Promise<void> {
  section('4. Stripe');

  if (!process.env.STRIPE_SECRET_KEY) {
    console.log('  ⏭️  Non configuré — aucun achat possible.');
    return;
  }

  const isLive = process.env.STRIPE_SECRET_KEY.startsWith('sk_live');
  try {
    const { default: Stripe } = await import('stripe');
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2026-06-24.dahlia',
    });
    // `balance.retrieve()` valide la clé sans exiger d'identifiant de compte,
    // contrairement à `accounts.retrieve()` qui en demande un dans cette
    // version d'API.
    const balance = await stripe.balance.retrieve();
    console.log(
      `  ✅ Clé valide — devise ${balance.available[0]?.currency?.toUpperCase() ?? 'n/a'}` +
        `${isLive ? ' (MODE RÉEL)' : ' (mode test)'}`,
    );
    if (isLive && !process.env.STRIPE_WEBHOOK_SECRET) {
      console.log('  🔴 Clé LIVE sans STRIPE_WEBHOOK_SECRET : les paiements ne créditeront rien.');
      blockers += 1;
    }
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    console.log(`  🔴 Clé refusée : ${detail}`);
    blockers += 1;
  }
}

async function checkPurgeCadence(): Promise<void> {
  section('5. Purge RGPD — cohérence avec ce que promettent les pages légales');

  try {
    const { readFile } = await import('node:fs/promises');
    const raw = await readFile('vercel.json', 'utf8');
    const config = JSON.parse(raw) as { crons?: { path: string; schedule: string }[] };
    const cron = config.crons?.find((c) => c.path.includes('purge'));

    if (!cron) {
      console.log('  🔴 Aucun cron de purge dans vercel.json.');
      blockers += 1;
      return;
    }

    console.log(`  Planification actuelle : « ${cron.schedule} »`);

    // Un cron quotidien ne peut pas tenir une promesse de 24 h : une image
    // créée juste après le passage attend le suivant, soit jusqu'à ~48 h.
    // Le champ des heures (2e position) vaut « * » quand le passage est horaire.
    const hourField = cron.schedule.trim().split(/\s+/)[1];
    if (hourField === '*' || hourField?.startsWith('*/')) {
      console.log('  ✅ Passage horaire : la fenêtre réelle reste sous 25 h.');
    } else {
      console.log(
        '  🟠 Passage quotidien. Une image créée juste après le passage attend\n' +
          '       le suivant : la conservation réelle peut atteindre ~48 h, alors que\n' +
          '       /confidentialite et /cgv promettent 24 h. Incohérence à régler.',
      );
      console.log(
        '       Trois options :\n' +
          '         a) Vercel Pro — les crons horaires y sont autorisés ;\n' +
          '         b) GitHub Actions toutes les heures sur /api/cron/purge (gratuit) ;\n' +
          '         c) corriger les pages légales pour annoncer 48 h.',
      );
    }
  } catch (cause) {
    console.log(`  ⚠️  vercel.json illisible : ${cause instanceof Error ? cause.message : cause}`);
  }
}

async function main(): Promise<void> {
  console.log('\n🩺 Fauxto — diagnostic de mise en service');

  checkEnv();
  await checkModels();
  await checkSupabase();
  await checkStripe();
  await checkPurgeCadence();

  section('Verdict');
  if (blockers === 0) {
    console.log('  ✅ Aucun bloquant. Le parcours de génération devrait fonctionner.');
    console.log('     Teste-le pour de vrai : pnpm test:templates ./photo.jpg');
  } else {
    console.log(`  🔴 ${blockers} bloquant(s) : le produit ne peut pas générer d’image.`);
  }
  console.log('');
  process.exit(blockers === 0 ? 0 : 1);
}

void main();

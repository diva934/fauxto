/**
 * Génère les 10 templates sur une photo d'exemple et sauvegarde les résultats.
 *
 * C'est l'outil d'itération sur la qualité des prompts : il court-circuite
 * complètement l'interface web, la base de données et le paiement. Si un prompt
 * donne un résultat médiocre, c'est ici qu'on le corrige, pas dans le navigateur.
 *
 * Usage :
 *   pnpm test:templates ./photo.jpg
 *   pnpm test:templates ./photo.jpg --only=dans-40-ans,bodybuilder
 *   pnpm test:templates ./photo.jpg --out=./resultats --skip-moderation
 *
 * Nécessite GEMINI_API_KEY dans .env.local.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';
import { getImageEngine, resolveModelId } from '../lib/image-engine';
import { EngineError } from '../lib/image-engine/types';
import { moderateSourceImage } from '../lib/moderation';
import { finalizeImage } from '../lib/postprocess';
import { TEMPLATES, type PrankTemplate } from '../lib/templates';

interface Args {
  photoPath: string;
  only: string[] | null;
  outDir: string;
  skipModeration: boolean;
  watermarked: boolean;
}

function parseArgs(argv: string[]): Args {
  const positional = argv.filter((arg) => !arg.startsWith('--'));
  const flags = new Map(
    argv
      .filter((arg) => arg.startsWith('--'))
      .map((arg) => {
        const [key, ...rest] = arg.replace(/^--/, '').split('=');
        return [key, rest.join('=') || 'true'] as const;
      }),
  );

  const photoPath = positional[0];
  if (!photoPath) {
    console.error(
      'Usage : pnpm test:templates <chemin-photo> [--only=id1,id2] [--out=dossier] [--skip-moderation] [--no-watermark]',
    );
    process.exit(1);
  }

  return {
    photoPath: resolve(process.cwd(), photoPath),
    only: flags.has('only') ? (flags.get('only') as string).split(',').map((s) => s.trim()) : null,
    outDir: resolve(process.cwd(), flags.get('out') ?? './test-output'),
    skipModeration: flags.get('skip-moderation') === 'true',
    watermarked: flags.get('no-watermark') !== 'true',
  };
}

function mimeFromPath(path: string): string {
  const ext = extname(path).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

function formatDuration(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`;
}

function formatBytes(bytes: number): string {
  return `${(bytes / 1024).toFixed(0)} Ko`;
}

interface Row {
  template: string;
  status: 'ok' | 'échec';
  engineMs: number | null;
  totalMs: number;
  size: string;
  c2pa: string;
  detail: string;
}

async function runTemplate(
  template: PrankTemplate,
  source: Buffer,
  sourceMimeType: string,
  args: Args,
): Promise<Row> {
  const startedAt = Date.now();
  process.stdout.write(`  ${template.emoji} ${template.nameFr.padEnd(28)} `);

  try {
    const edited = await getImageEngine().edit({
      sourceImage: source,
      sourceMimeType,
      prompt: template.prompt,
      aspectRatio: template.aspectRatio,
      modelId: resolveModelId(template.model),
    });

    const finalized = await finalizeImage({
      image: edited.image,
      template,
      aspectRatio: template.aspectRatio,
      modelId: edited.modelId,
      provider: edited.provider,
      watermarked: args.watermarked,
      domain: 'fauxto.com',
    });

    const outPath = resolve(args.outDir, `${template.id}.jpg`);
    await writeFile(outPath, finalized.image);

    const totalMs = Date.now() - startedAt;
    console.log(
      `✅ ${formatDuration(edited.latencyMs)} moteur · ${formatBytes(finalized.bytes)} · ${finalized.width}×${finalized.height}`,
    );

    return {
      template: template.nameFr,
      status: 'ok',
      engineMs: edited.latencyMs,
      totalMs,
      size: `${finalized.width}×${finalized.height}`,
      c2pa: finalized.marking.c2paApplied ? finalized.marking.c2paSigner : 'non appliqué',
      detail: outPath,
    };
  } catch (cause) {
    const totalMs = Date.now() - startedAt;
    const detail =
      cause instanceof EngineError
        ? `${cause.code} — ${cause.message}`
        : cause instanceof Error
          ? cause.message
          : String(cause);
    console.log(`❌ ${detail}`);
    return {
      template: template.nameFr,
      status: 'échec',
      engineMs: null,
      totalMs,
      size: '—',
      c2pa: '—',
      detail,
    };
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (!process.env.GEMINI_API_KEY) {
    console.error(
      '\n❌ GEMINI_API_KEY absente.\n' +
        '   Renseigne-la dans .env.local, puis relance.\n' +
        '   Le script la lit via --env-file-if-exists=.env.local (voir package.json).\n',
    );
    process.exit(1);
  }

  const source = await readFile(args.photoPath).catch(() => {
    console.error(`\n❌ Photo introuvable : ${args.photoPath}\n`);
    process.exit(1);
  });
  const sourceMimeType = mimeFromPath(args.photoPath);

  const selected = args.only
    ? TEMPLATES.filter((t) => args.only?.includes(t.id))
    : [...TEMPLATES];

  if (selected.length === 0) {
    console.error(
      `\n❌ Aucun template ne correspond à --only.\n   Identifiants valides : ${TEMPLATES.map((t) => t.id).join(', ')}\n`,
    );
    process.exit(1);
  }

  await mkdir(args.outDir, { recursive: true });

  console.log(`\n📷 Photo source : ${basename(args.photoPath)}`);
  console.log(`📁 Sortie       : ${args.outDir}`);
  console.log(`🎯 Templates    : ${selected.length}/${TEMPLATES.length}`);
  console.log(`💧 Filigrane    : ${args.watermarked ? 'oui (comme le palier gratuit)' : 'non (comme le palier payant)'}\n`);

  // La modération porte sur la photo SOURCE : une seule fois, pas par template.
  if (args.skipModeration) {
    console.log('⚠️  Modération désactivée (--skip-moderation). À ne jamais faire en production.\n');
  } else {
    process.stdout.write('🛡️  Modération de la photo source… ');
    const decision = await moderateSourceImage({ image: source, mimeType: sourceMimeType });
    if (!decision.allowed) {
      console.log(`refusée (${decision.flag})`);
      console.log(`\n   ${decision.messageFr}\n`);
      if (decision.analysis) {
        console.log(`   Analyse : ${JSON.stringify(decision.analysis, null, 2)}\n`);
      }
      console.log(
        '   Pour itérer sur les prompts avec une photo de test, relance avec --skip-moderation.\n',
      );
      process.exit(2);
    }
    console.log(
      `acceptée (âge min. estimé : ${decision.analysis.estimatedMinAge ?? 'aucune personne'}, confiance : ${decision.analysis.confidence})\n`,
    );
  }

  const rows: Row[] = [];
  for (const template of selected) {
    rows.push(await runTemplate(template, source, sourceMimeType, args));
  }

  const succeeded = rows.filter((r) => r.status === 'ok');
  const failed = rows.filter((r) => r.status === 'échec');
  const latencies = succeeded.map((r) => r.engineMs ?? 0).sort((a, b) => a - b);

  console.log('\n─────────────────────────────────────────────');
  console.log(`✅ Réussis : ${succeeded.length}/${rows.length}`);
  if (failed.length > 0) {
    console.log(`❌ Échecs  : ${failed.length}`);
    for (const row of failed) console.log(`   · ${row.template} — ${row.detail}`);
  }
  if (latencies.length > 0) {
    const median = latencies[Math.floor(latencies.length / 2)];
    const worst = latencies[latencies.length - 1];
    console.log(
      `⏱️  Latence moteur : médiane ${formatDuration(median)} · pire cas ${formatDuration(worst)}`,
    );
    // Le cahier des charges vise moins de 12 s de bout en bout.
    if (worst > 12_000) {
      console.log('   ⚠️  Le pire cas dépasse la cible de 12 s annoncée à l’utilisateur.');
    }
  }
  const c2paStates = new Set(succeeded.map((r) => r.c2pa));
  if (c2paStates.size > 0) {
    console.log(`🔖 C2PA : ${[...c2paStates].join(', ')}`);
    if (c2paStates.has('test')) {
      console.log('   ⚠️  Certificat de test — à remplacer par un vrai certificat en production.');
    }
  }
  console.log(`📁 Résultats dans ${args.outDir}`);
  console.log('─────────────────────────────────────────────\n');

  process.exit(failed.length > 0 ? 1 : 0);
}

void main();

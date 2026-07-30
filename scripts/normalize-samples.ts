/**
 * Installe des vignettes fournies à la main dans public/samples/.
 *
 * Recadre au ratio 4:5 exact via `normalizeAspectRatio` — LA MÊME fonction que
 * la chaîne de production. Les vignettes ont donc précisément le cadrage que
 * l'utilisateur verra sur son résultat, pas une approximation faite à l'œil.
 *
 * Deux façons de l'alimenter :
 *
 *   1. Dépose des fichiers correctement nommés dans `incoming/`, puis :
 *        pnpm normalize:samples
 *      Les noms attendus sont ceux de `lib/templates.ts`, sans extension :
 *        voiture-rayee-avant, voiture-rayee-apres, coupe-ratee-avant, …
 *
 *   2. Passe un fichier au nom quelconque avec sa cible :
 *        pnpm normalize:samples "C:/chemin/photo.png=voiture-rayee-apres"
 *
 * Les deux modes se cumulent.
 */

import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';
import sharp from 'sharp';
import { normalizeAspectRatio } from '../lib/postprocess/marking';
import { TEMPLATES } from '../lib/templates';

const INCOMING = resolve(process.cwd(), 'incoming');
const OUT_DIR = resolve(process.cwd(), 'public/samples');
const TILE_WIDTH = 800;
const TILE_HEIGHT = Math.round((TILE_WIDTH * 5) / 4);

const ACCEPTED = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);

/** Noms de vignettes valides, dérivés des templates — jamais codés en dur. */
const VALID_TARGETS = new Map<string, string>();
for (const template of TEMPLATES) {
  for (const declared of [template.thumbnailBefore, template.thumbnailAfter]) {
    const filename = declared.replace(/^\/samples\//, '');
    VALID_TARGETS.set(filename.replace(/\.[^.]+$/, ''), filename);
  }
}

interface Job {
  source: string;
  target: string;
  stem: string;
}

function parseExplicitArgs(argv: string[]): Job[] {
  const jobs: Job[] = [];
  for (const arg of argv) {
    const separator = arg.lastIndexOf('=');
    if (separator <= 0) {
      console.log(`  ⚠️  Argument ignoré (attendu « chemin=cible ») : ${arg}`);
      continue;
    }
    const source = resolve(process.cwd(), arg.slice(0, separator));
    const stem = arg.slice(separator + 1).trim();
    const target = VALID_TARGETS.get(stem);
    if (!target) {
      console.log(`  ⚠️  Cible inconnue : « ${stem} »`);
      continue;
    }
    jobs.push({ source, target, stem });
  }
  return jobs;
}

async function scanIncoming(): Promise<Job[]> {
  const jobs: Job[] = [];
  let entries: string[];
  try {
    entries = await readdir(INCOMING);
  } catch {
    return jobs;
  }

  for (const entry of entries) {
    const extension = extname(entry).toLowerCase();
    if (!ACCEPTED.has(extension)) continue;
    const stem = basename(entry, extension);
    const target = VALID_TARGETS.get(stem);
    if (!target) {
      console.log(`  ⚠️  ${entry} — nom non reconnu, ignoré`);
      continue;
    }
    jobs.push({ source: resolve(INCOMING, entry), target, stem });
  }
  return jobs;
}

async function install(job: Job): Promise<boolean> {
  try {
    const original = await sharp(job.source).toBuffer();
    const meta = await sharp(original).metadata();

    // Recadrage au ratio exact, puis mise à l'échelle. `fit: cover` ne fait
    // plus que du redimensionnement à ce stade, le ratio est déjà bon.
    const cropped = await normalizeAspectRatio(original, '4:5');
    const tile = await sharp(cropped)
      .resize({ width: TILE_WIDTH, height: TILE_HEIGHT, fit: 'cover' })
      .jpeg({ quality: 84, mozjpeg: true })
      .toBuffer();

    await writeFile(resolve(OUT_DIR, job.target), tile);
    console.log(
      `  ✅ ${job.target} — source ${meta.width}×${meta.height} → ${TILE_WIDTH}×${TILE_HEIGHT} (${(tile.byteLength / 1024).toFixed(0)} Ko)`,
    );
    return true;
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    console.log(`  ❌ ${job.stem} — ${detail}`);
    return false;
  }
}

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });

  console.log('\n🖼️  Normalisation des vignettes\n');

  const jobs = [...(await scanIncoming()), ...parseExplicitArgs(process.argv.slice(2))];

  if (jobs.length === 0) {
    console.log(
      `  Rien à faire.\n\n` +
        `  Dépose des fichiers nommés comme suit dans ${INCOMING} :\n` +
        [...VALID_TARGETS.keys()].map((k) => `    · ${k}`).join('\n') +
        `\n\n  Ou passe un fichier explicitement :\n` +
        `    pnpm normalize:samples "chemin/vers/image.png=voiture-rayee-apres"\n`,
    );
    process.exit(0);
  }

  let installed = 0;
  for (const job of jobs) {
    if (await install(job)) installed += 1;
  }

  // Contrôle final : le ratio doit être exactement 0,8 sur ce qui vient d'être
  // écrit. Une vérification qui ne mesure rien ne vaut rien.
  const checks = await Promise.all(
    jobs.map(async (job) => {
      try {
        const meta = await sharp(resolve(OUT_DIR, job.target)).metadata();
        const ratio = (meta.width ?? 0) / (meta.height ?? 1);
        return { target: job.target, ok: Math.abs(ratio - 0.8) < 0.001, ratio };
      } catch {
        return { target: job.target, ok: false, ratio: 0 };
      }
    }),
  );
  const bad = checks.filter((c) => !c.ok);

  console.log(
    `\n─────────────────────────────────────────────\n` +
      `✅ ${installed}/${jobs.length} vignette(s) installée(s)\n` +
      (bad.length === 0
        ? `📐 Ratio 4:5 vérifié sur toutes (0.8000)\n`
        : `❌ Ratio incorrect : ${bad.map((b) => `${b.target} (${b.ratio.toFixed(4)})`).join(', ')}\n`) +
      `📁 ${OUT_DIR}\n` +
      `─────────────────────────────────────────────\n`,
  );

  process.exit(installed === jobs.length && bad.length === 0 ? 0 : 1);
}

void main();

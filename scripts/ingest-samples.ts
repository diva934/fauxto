/**
 * Récupère les vignettes avant/après générées par Higgsfield et les installe
 * dans public/samples/ au format attendu par lib/templates.ts.
 *
 * Les visages sont SYNTHÉTIQUES : aucune personne réelle, donc aucun droit à
 * l'image ni consentement en jeu. C'est la seule façon correcte de produire des
 * démonstrations pour ce produit.
 *
 * Le recadrage passe par `normalizeAspectRatio`, la même fonction que la chaîne
 * de production : les vignettes ont donc exactement le cadrage que l'utilisateur
 * verra sur son résultat.
 *
 * Usage : pnpm ingest:samples
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { normalizeAspectRatio } from '../lib/postprocess/marking';
import { TEMPLATES, type PrankTemplate } from '../lib/templates';

const CDN = 'https://d8j0ntlcm91z4.cloudfront.net/user_3GtvG6Efq5x8MjEWnBUvS9l73pl';
const OUT_DIR = resolve(process.cwd(), 'public/samples');

/** Largeur finale des vignettes. 800×1000 = 4:5, suffisant pour une grille mobile. */
const TILE_WIDTH = 800;

/** job_id -> nom de fichier sur le CDN Higgsfield. */
const ASSETS: Record<string, string> = {
  // Sources synthétiques (gpt_image_2)
  portrait: 'hf_20260729_230138_93c2e161-687b-4773-a582-62fb6c68812b.png',
  demiCorps: 'hf_20260729_230142_ff37c1bd-5ba7-46be-a80b-733013045e0a.png',
  voiture: 'hf_20260729_230145_53176721-ffd2-49a9-bf22-8a02891db7f6.png',
  salon: 'hf_20260729_230149_72cfa0d8-a986-415f-b776-60f6d48e4e46.png',
  // Résultats des 10 prompts (flux_kontext)
  apresVoiture: 'hf_20260729_230333_686995ab-3e60-4a64-af56-53131ef68ffd.png',
  apresCoupe: 'hf_20260729_230337_53eea594-775c-428a-a2ac-5e6235599769.png',
  apres40ans: 'hf_20260729_230342_4118265e-f952-4bb8-89c2-abd7c4df3f33.png',
  apresBody: 'hf_20260729_230347_52317842-b2ce-4c3c-bb28-0f1e2f660fe3.png',
  apresLoto: 'hf_20260729_230406_c500743f-be2e-4f9c-9ac3-e6730e4aebac.png',
  apresTatouage: 'hf_20260729_230410_8e36b062-69da-4343-9b93-e16d7583873b.png',
  apresLion: 'hf_20260729_230423_26c6841a-8117-4d3f-8e2d-744d16e1d0ad.png',
  // Le template « Maldives » a été renommé en « Dubaï » : cette source plage
  // n'est plus utilisée. Conservée ici au cas où tu reviennes en arrière.
  apresMaldivesObsolete: 'hf_20260729_230427_97caf76a-4c82-4e2d-a88b-75c899d6beb9.png',
  apresMagazine: 'hf_20260729_230442_86c157ba-78a5-4c9f-a0d3-2d6613ab3447.png',
  // Le prompt d'origine du template 10 a été refusé par le filtre du
  // fournisseur (statut `nsfw`, faux positif sur un costume de mascotte).
  // Celui-ci est une reformulation qui passe — cf. note dans le README.
  apresDeguisement: 'hf_20260729_230643_bb8e3e52-92bd-4d85-b8e3-7668bae6b7f4.png',
  /** Sentinelle : vignette fournie à la main, ce script doit la laisser tranquille. */
  fourniAlaMain: 'PENDING',
};

/** template id -> quelle source et quel résultat. */
const MAPPING: Record<string, { before: keyof typeof ASSETS; after: keyof typeof ASSETS }> = {
  'voiture-rayee': { before: 'voiture', after: 'apresVoiture' },
  'coupe-ratee': { before: 'portrait', after: 'apresCoupe' },
  'dans-40-ans': { before: 'portrait', after: 'apres40ans' },
  bodybuilder: { before: 'demiCorps', after: 'apresBody' },
  'gagnant-loto': { before: 'demiCorps', after: 'apresLoto' },
  'tatouage-rate': { before: 'demiCorps', after: 'apresTatouage' },
  'lion-salon': { before: 'salon', after: 'apresLion' },
  // Dubaï : le « après » n'est PAS issu de Higgsfield, il est fourni à la main
  // et installé par `pnpm normalize:samples`. On pointe donc vers le sentinelle
  // pour que ce script laisse le fichier existant intact au lieu de l'écraser.
  dubai: { before: 'demiCorps', after: 'fourniAlaMain' },
  'une-magazine': { before: 'portrait', after: 'apresMagazine' },
  deguisement: { before: 'demiCorps', after: 'apresDeguisement' },
};

const cache = new Map<string, Buffer>();

async function fetchAsset(key: string): Promise<Buffer | null> {
  const filename = ASSETS[key];
  if (!filename || filename === 'PENDING') return null;

  const cached = cache.get(filename);
  if (cached) return cached;

  const response = await fetch(`${CDN}/${filename}`);
  if (!response.ok) {
    console.log(`  ⚠️  ${key} : HTTP ${response.status}`);
    return null;
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  cache.set(filename, buffer);
  return buffer;
}

/** Recadre en 4:5 exact avec la fonction de production, puis redimensionne. */
async function toTile(source: Buffer): Promise<Buffer> {
  const cropped = await normalizeAspectRatio(source, '4:5');
  return sharp(cropped)
    .resize({ width: TILE_WIDTH, height: Math.round((TILE_WIDTH * 5) / 4), fit: 'cover' })
    .jpeg({ quality: 84, mozjpeg: true })
    .toBuffer();
}

async function installFor(template: PrankTemplate): Promise<{ before: boolean; after: boolean }> {
  const mapping = MAPPING[template.id];
  if (!mapping) return { before: false, after: false };

  const outcome = { before: false, after: false };

  for (const side of ['before', 'after'] as const) {
    const declared = side === 'before' ? template.thumbnailBefore : template.thumbnailAfter;
    const filename = declared.replace(/^\/samples\//, '');
    const source = await fetchAsset(mapping[side]);

    if (!source) {
      console.log(`  ⏭️  ${filename} — source indisponible, placeholder conservé`);
      continue;
    }

    await writeFile(resolve(OUT_DIR, filename), await toTile(source));
    const meta = await sharp(resolve(OUT_DIR, filename)).metadata();
    console.log(`  ✅ ${filename} (${meta.width}×${meta.height})`);
    outcome[side] = true;
  }

  return outcome;
}

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  console.log('\n🖼️  Installation des vignettes générées\n');

  let installed = 0;
  let skipped = 0;

  for (const template of TEMPLATES) {
    console.log(`${template.emoji} ${template.nameFr}`);
    const result = await installFor(template);
    installed += Number(result.before) + Number(result.after);
    skipped += Number(!result.before) + Number(!result.after);
  }

  const ratio = await sharp(
    resolve(OUT_DIR, TEMPLATES[0].thumbnailAfter.replace(/^\/samples\//, '')),
  ).metadata();

  console.log(
    `\n─────────────────────────────────────────────\n` +
      `✅ ${installed} vignettes installées\n` +
      (skipped > 0 ? `⏭️  ${skipped} ignorées (source indisponible)\n` : '') +
      `📐 Ratio vérifié : ${ratio.width}×${ratio.height} = ${((ratio.width ?? 0) / (ratio.height ?? 1)).toFixed(4)} (4:5 = 0.8000)\n` +
      `📁 ${OUT_DIR}\n` +
      `─────────────────────────────────────────────\n`,
  );
}

void main();

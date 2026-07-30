/**
 * Génère des vignettes avant/après de REMPLACEMENT pour les 10 templates.
 *
 * ⚠️ Ce ne sont PAS des exemples réels. Il est impossible de produire de vraies
 * photos de canular sans clé API, et inventer des visages serait pire que de ne
 * rien mettre. Ces images existent pour que l'interface soit complète et
 * testable — elles sont explicitement marquées « EXEMPLE » afin que personne ne
 * les confonde avec le rendu du produit.
 *
 * À REMPLACER AVANT LE LANCEMENT : la grille avant/après est l'argument de vente
 * principal du produit (§3.1). Une fois ta clé Gemini en place :
 *   1. pnpm test:templates ./ta-photo.jpg
 *   2. recadre les résultats en 4:5
 *   3. remplace les fichiers dans public/samples/
 *
 * Usage : pnpm samples
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { TEMPLATES } from '../lib/templates';

const OUT_DIR = resolve(process.cwd(), 'public/samples');

const WIDTH = 800;
const HEIGHT = 1000; // 4:5

const FONT = "'DejaVu Sans','Liberation Sans',Arial,sans-serif";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Découpe un libellé en lignes qui tiennent dans la largeur. */
function wrap(text: string, maxChars: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if ((current + ' ' + word).trim().length > maxChars && current) {
      lines.push(current.trim());
      current = word;
    } else {
      current = `${current} ${word}`.trim();
    }
  }
  if (current) lines.push(current);
  return lines;
}

function tileSvg(options: {
  kind: 'avant' | 'apres';
  label: string;
  emoji: string;
}): string {
  const { kind, label, emoji } = options;
  const isAfter = kind === 'apres';

  // « Avant » en gris neutre, « après » teinté d'accent : la différence doit
  // sauter aux yeux pour que l'animation de révélation soit lisible.
  const bgFrom = isAfter ? '#2b3a0f' : '#1b1b22';
  const bgTo = isAfter ? '#0f1405' : '#101015';
  const accent = isAfter ? '#D6FF3E' : '#5a5a6b';

  const lines = wrap(label, 16);
  const lineHeight = 54;
  const startY = HEIGHT * 0.62;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.6" y2="1">
      <stop offset="0%" stop-color="${bgFrom}"/>
      <stop offset="100%" stop-color="${bgTo}"/>
    </linearGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>

  <!-- Silhouette neutre : aucun visage, aucune personne réelle -->
  <g opacity="${isAfter ? '0.5' : '0.32'}" fill="${accent}">
    <circle cx="${WIDTH / 2}" cy="${HEIGHT * 0.3}" r="${WIDTH * 0.13}"/>
    <path d="M ${WIDTH * 0.22} ${HEIGHT * 0.56}
             q ${WIDTH * 0.28} -${HEIGHT * 0.16} ${WIDTH * 0.56} 0
             l 0 ${HEIGHT * 0.06} l -${WIDTH * 0.56} 0 Z"/>
  </g>

  <text x="${WIDTH / 2}" y="${HEIGHT * 0.44}" font-size="90" text-anchor="middle" dominant-baseline="middle">${emoji}</text>

  <!-- Bandeau EXEMPLE : impossible de confondre avec un rendu réel -->
  <rect x="0" y="${HEIGHT * 0.04}" width="${WIDTH}" height="46" fill="#000000" fill-opacity="0.55"/>
  <text x="${WIDTH / 2}" y="${HEIGHT * 0.04 + 23}" font-family="${FONT}" font-size="22" font-weight="700"
        fill="#ffffff" text-anchor="middle" dominant-baseline="middle" letter-spacing="3">EXEMPLE — À REMPLACER</text>

  <text x="${WIDTH / 2}" y="${HEIGHT * 0.54}" font-family="${FONT}" font-size="30" font-weight="700"
        fill="${accent}" text-anchor="middle" letter-spacing="6">${isAfter ? 'APRÈS' : 'AVANT'}</text>

  ${lines
    .map(
      (line, index) =>
        `<text x="${WIDTH / 2}" y="${startY + index * lineHeight}" font-family="${FONT}" font-size="42" font-weight="700"
        fill="#f5f5f7" text-anchor="middle">${escapeXml(line)}</text>`,
    )
    .join('\n  ')}
</svg>`;
}

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });

  console.log('\n🖼️  Génération des vignettes de remplacement\n');

  let count = 0;
  for (const template of TEMPLATES) {
    for (const kind of ['avant', 'apres'] as const) {
      const svg = tileSvg({
        kind,
        label: template.nameFr,
        emoji: template.emoji,
      });
      // Les chemins doivent correspondre exactement à `thumbnailBefore` /
      // `thumbnailAfter` de lib/templates.ts.
      const declared = kind === 'avant' ? template.thumbnailBefore : template.thumbnailAfter;
      const filename = declared.replace(/^\/samples\//, '');

      const buffer = await sharp(Buffer.from(svg))
        .jpeg({ quality: 82, mozjpeg: true })
        .toBuffer();
      await writeFile(resolve(OUT_DIR, filename), buffer);
      count += 1;
      console.log(`  ✅ ${filename}`);
    }
  }

  console.log(
    `\n─────────────────────────────────────────────\n` +
      `✅ ${count} vignettes générées\n` +
      `📁 ${OUT_DIR}\n\n` +
      `⚠️  Ce sont des REMPLACEMENTS, pas des exemples réels.\n` +
      `   Remplace-les par de vrais rendus avant le lancement :\n` +
      `   la grille avant/après est ce qui vend le produit.\n` +
      `─────────────────────────────────────────────\n`,
  );
}

void main();

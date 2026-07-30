/**
 * Assemble une planche de contact avant/après des 10 templates.
 *
 * Sert à juger d'un coup d'œil la qualité des prompts, sans ouvrir 20 fichiers.
 *
 * Usage : pnpm sheet
 */

import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp, { type OverlayOptions } from 'sharp';
import { TEMPLATES } from '../lib/templates';

const SAMPLES = resolve(process.cwd(), 'public/samples');
const OUT = resolve(process.cwd(), 'test-output/planche-avant-apres.jpg');

const THUMB_W = 210;
const THUMB_H = Math.round((THUMB_W * 5) / 4); // 4:5
const GAP = 8;
const LABEL_H = 34;
const COLS = 2;

const CELL_W = THUMB_W * 2 + GAP;
const CELL_H = THUMB_H + LABEL_H;
const ROWS = Math.ceil(TEMPLATES.length / COLS);
const PADDING = 16;

const WIDTH = COLS * CELL_W + (COLS + 1) * PADDING;
const HEIGHT = ROWS * CELL_H + (ROWS + 1) * PADDING + 46;

function escapeXml(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function main(): Promise<void> {
  const layers: OverlayOptions[] = [];
  const labels: string[] = [];

  for (const [index, template] of TEMPLATES.entries()) {
    const col = index % COLS;
    const row = Math.floor(index / COLS);
    const x = PADDING + col * (CELL_W + PADDING);
    const y = 46 + PADDING + row * (CELL_H + PADDING);

    for (const [side, file] of [
      ['avant', template.thumbnailBefore],
      ['apres', template.thumbnailAfter],
    ] as const) {
      const path = resolve(SAMPLES, file.replace(/^\/samples\//, ''));
      const thumb = await sharp(path).resize(THUMB_W, THUMB_H, { fit: 'cover' }).toBuffer();
      layers.push({
        input: thumb,
        left: x + (side === 'avant' ? 0 : THUMB_W + GAP),
        top: y,
      });
    }

    labels.push(
      `<text x="${x}" y="${y + THUMB_H + 21}" font-family="DejaVu Sans,Arial,sans-serif" font-size="15" font-weight="700" fill="#f5f5f7">${escapeXml(
        `${index + 1}. ${template.nameFr}`,
      )}</text>`,
      `<text x="${x + THUMB_W + GAP}" y="${y + THUMB_H + 21}" font-family="DejaVu Sans,Arial,sans-serif" font-size="13" fill="#9a9aab">après →</text>`,
    );
  }

  const textLayer = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
      <text x="${PADDING}" y="30" font-family="DejaVu Sans,Arial,sans-serif" font-size="22" font-weight="700" fill="#d6ff3e">Fauxto — 10 prompts, avant / après</text>
      ${labels.join('\n      ')}
    </svg>`,
  );

  const sheet = await sharp({
    create: { width: WIDTH, height: HEIGHT, channels: 4, background: '#0b0b0f' },
  })
    .composite([...layers, { input: textLayer, top: 0, left: 0 }])
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();

  await writeFile(OUT, sheet);
  console.log(`\n✅ Planche écrite : ${OUT} (${WIDTH}×${HEIGHT}, ${(sheet.byteLength / 1024).toFixed(0)} Ko)\n`);
}

void main();

import 'server-only';
import sharp from 'sharp';
import type { AspectRatio } from '@/lib/image-engine/types';
import { buildPillLayer, buildTextLayer, estimateTextWidth } from './svg-text';

/**
 * Marquage des images — couche visible du dispositif de conformité.
 *
 * Trois couches sont exigées par l'article 50 de l'AI Act (applicable au
 * 2 août 2026). Ce fichier en porte deux :
 *   - la mention lisible par un humain (obligatoire, sur TOUTES les images) ;
 *   - le filigrane commercial (retiré à l'achat, purement produit).
 * La troisième (métadonnées C2PA) vit dans `c2pa.ts`. Le watermark
 * machine-lisible SynthID est incorporé par le modèle : on ne le fabrique pas,
 * on se contente de ne pas le détruire.
 */

/** Mention légale imposée par l'AI Act. Ne jamais rendre conditionnelle. */
export const LEGAL_LABEL_FR = 'Image générée par IA';

const TARGET_RATIO: Record<AspectRatio, number> = {
  '1:1': 1,
  '4:5': 4 / 5,
  '9:16': 9 / 16,
};

/**
 * Recadre au ratio exact demandé par le produit.
 *
 * Nécessaire parce que le fournisseur ne garantit pas tous les ratios : on lui
 * demande le plus proche, et on normalise ici. Le recadrage est centré et
 * n'agrandit jamais l'image (pas d'interpolation destructrice).
 */
export async function normalizeAspectRatio(
  input: Buffer,
  aspectRatio: AspectRatio,
): Promise<Buffer> {
  const image = sharp(input, { failOn: 'none' });
  const meta = await image.metadata();
  const width = meta.width;
  const height = meta.height;

  if (!width || !height) {
    throw new Error("Image illisible : dimensions absentes");
  }

  const target = TARGET_RATIO[aspectRatio];
  const current = width / height;

  // Déjà au bon ratio à 0,5 % près : on ne touche à rien, pour préserver
  // au maximum le watermark SynthID.
  if (Math.abs(current - target) / target < 0.005) {
    return input;
  }

  const cropWidth = current > target ? Math.round(height * target) : width;
  const cropHeight = current > target ? height : Math.round(width / target);

  return sharp(input, { failOn: 'none' })
    .extract({
      left: Math.round((width - cropWidth) / 2),
      top: Math.round((height - cropHeight) / 2),
      width: cropWidth,
      height: cropHeight,
    })
    .png({ compressionLevel: 6 })
    .toBuffer();
}

async function dimensions(input: Buffer): Promise<{ width: number; height: number }> {
  const meta = await sharp(input, { failOn: 'none' }).metadata();
  if (!meta.width || !meta.height) throw new Error('Image illisible : dimensions absentes');
  return { width: meta.width, height: meta.height };
}

/**
 * Incruste « Image générée par IA » en bas à gauche.
 *
 * Placée sur une pastille sombre semi-opaque pour rester lisible quel que soit
 * le fond, et dimensionnée relativement à l'image pour qu'un recadrage grossier
 * ne puisse pas la faire disparaître discrètement.
 */
export async function applyLegalLabel(input: Buffer): Promise<Buffer> {
  const { width, height } = await dimensions(input);

  const fontSize = Math.max(14, Math.round(width * 0.032));
  const paddingX = Math.round(fontSize * 0.7);
  const paddingY = Math.round(fontSize * 0.45);
  const margin = Math.round(width * 0.03);

  const textWidth = estimateTextWidth(LEGAL_LABEL_FR, fontSize, true);
  const pillWidth = Math.round(textWidth + paddingX * 2);
  const pillHeight = Math.round(fontSize + paddingY * 2);
  const pillX = margin;
  const pillY = height - margin - pillHeight;

  const pill = buildPillLayer({
    width,
    height,
    x: pillX,
    y: pillY,
    pillWidth,
    pillHeight,
    radius: Math.round(pillHeight / 2),
    fill: '#000000',
    opacity: 0.62,
  });

  const label = buildTextLayer({
    width,
    height,
    text: LEGAL_LABEL_FR,
    x: pillX + paddingX,
    y: pillY + pillHeight / 2,
    fontSize,
    color: '#ffffff',
    align: 'left',
    bold: true,
  });

  return sharp(input, { failOn: 'none' })
    .composite([
      { input: pill, top: 0, left: 0 },
      { input: label, top: 0, left: 0 },
    ])
    .png({ compressionLevel: 6 })
    .toBuffer();
}

/**
 * Filigrane commercial : le nom de domaine, en diagonale, sur les images
 * générées gratuitement. Contrairement à la mention légale, celui-ci disparaît
 * à l'achat — c'est le levier de conversion, pas une obligation.
 */
export async function applyCommercialWatermark(
  input: Buffer,
  domain: string,
): Promise<Buffer> {
  const { width, height } = await dimensions(input);

  const fontSize = Math.max(18, Math.round(width * 0.055));
  const text = domain.toUpperCase();

  // Répété en diagonale : un recadrage ne suffit pas à s'en débarrasser.
  const rows = 4;
  const marks = Array.from({ length: rows }, (_, index) => {
    const y = Math.round(((index + 0.5) / rows) * height);
    return `<text x="${width / 2}" y="${y}" font-family="'DejaVu Sans','Liberation Sans',Arial,sans-serif" font-size="${fontSize}" font-weight="700" fill="#ffffff" fill-opacity="0.28" text-anchor="middle" dominant-baseline="middle" letter-spacing="${(
      fontSize * 0.12
    ).toFixed(1)}" transform="rotate(-24 ${width / 2} ${y})">${text}</text>`;
  }).join('\n  ');

  const overlay = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  ${marks}
</svg>`,
  );

  return sharp(input, { failOn: 'none' })
    .composite([{ input: overlay, top: 0, left: 0 }])
    .png({ compressionLevel: 6 })
    .toBuffer();
}

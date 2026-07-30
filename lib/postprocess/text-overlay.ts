import 'server-only';
import sharp from 'sharp';
import type { PrankTemplate, TextOverlaySlot } from '@/lib/templates';
import { buildTextLayer, estimateTextWidth } from './svg-text';

/**
 * Incrustation du texte des templates « chèque géant » et « une de magazine ».
 *
 * On ne demande jamais au modèle d'écrire le texte français dans l'image : le
 * rendu typographique des modèles est peu fiable et l'orthographe dérape. On
 * génère donc l'image avec des zones vides, et on écrit par-dessus ici — ce qui
 * donne en prime la personnalisation (le prénom de la victime sur le chèque).
 */

/** Saisies utilisateur, indexées par la position du slot dans le template. */
export type OverlayInputs = Record<number, string>;

function resolveText(slot: TextOverlaySlot, userInput: string | undefined): string {
  const trimmed = userInput?.trim();
  if (!trimmed) return slot.defaultText;

  const value = slot.template ? slot.template.replace('{input}', trimmed) : trimmed;
  return slot.uppercase ? value.toLocaleUpperCase('fr-FR') : value;
}

/**
 * Réduit la police jusqu'à ce que le texte tienne dans la largeur allouée.
 * L'estimation est approximative (pas de moteur de fonte disponible), donc on
 * garde une marge de sécurité de 8 %.
 */
function fitFontSize(text: string, maxWidthPx: number, initialFontSize: number): number {
  const safeWidth = maxWidthPx * 0.92;
  let fontSize = initialFontSize;
  while (fontSize > 8 && estimateTextWidth(text, fontSize, true) > safeWidth) {
    fontSize -= 1;
  }
  return fontSize;
}

export async function applyTextOverlays(
  input: Buffer,
  template: PrankTemplate,
  inputs: OverlayInputs = {},
): Promise<Buffer> {
  const slots = template.textOverlays;
  if (!slots || slots.length === 0) return input;

  const meta = await sharp(input, { failOn: 'none' }).metadata();
  const width = meta.width;
  const height = meta.height;
  if (!width || !height) throw new Error('Image illisible : dimensions absentes');

  const layers = slots.map((slot, index) => {
    const text = resolveText(slot, inputs[index]);
    const fontSize = fitFontSize(
      text,
      slot.maxWidth * width,
      Math.round(slot.fontScale * height),
    );

    return {
      input: buildTextLayer({
        width,
        height,
        text,
        x: Math.round(slot.x * width),
        y: Math.round(slot.y * height),
        fontSize,
        color: slot.color,
        align: slot.align,
        bold: true,
        // Un léger contour garantit la lisibilité même si la zone générée par
        // le modèle n'est pas aussi vide que demandé.
        stroke: { color: 'rgba(0,0,0,0.35)', width: Math.max(1, fontSize * 0.03) },
      }),
      top: 0,
      left: 0,
    };
  });

  return sharp(input, { failOn: 'none' })
    .composite(layers)
    .png({ compressionLevel: 6 })
    .toBuffer();
}

/** Nombre de champs personnalisables exposés à l'utilisateur pour un template. */
export function userInputSlots(
  template: PrankTemplate,
): { index: number; labelFr: string; defaultText: string }[] {
  return (template.textOverlays ?? [])
    .map((slot, index) => ({ slot, index }))
    .filter(({ slot }) => Boolean(slot.userInputLabelFr))
    .map(({ slot, index }) => ({
      index,
      labelFr: slot.userInputLabelFr as string,
      defaultText: slot.defaultText,
    }));
}

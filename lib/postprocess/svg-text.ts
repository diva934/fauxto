/**
 * Rendu de texte pour sharp, via SVG.
 *
 * Note sur les polices : sharp délègue le rendu SVG à librsvg, qui résout les
 * polices par fontconfig. On ne peut donc pas garantir une fonte précise sur
 * tous les environnements d'exécution — mais librsvg retombe toujours sur une
 * fonte disponible, donc le texte s'affiche systématiquement. Pour la mention
 * légale, c'est la lisibilité qui compte, pas la typographie exacte.
 */

const FONT_STACK =
  "'DejaVu Sans','Liberation Sans','Helvetica Neue',Helvetica,Arial,sans-serif";

/** Échappe les caractères qui casseraient le XML. */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Largeur approximative d'une chaîne, en pixels.
 *
 * On ne peut pas mesurer sans moteur de fonte, donc on estime à partir d'une
 * largeur moyenne de glyphe. Utilisé uniquement pour dimensionner les fonds
 * (pastilles, bandeaux), avec une marge généreuse — jamais pour du placement
 * qui exigerait de la précision.
 */
export function estimateTextWidth(text: string, fontSize: number, bold = false): number {
  const averageGlyphRatio = bold ? 0.62 : 0.55;
  return text.length * fontSize * averageGlyphRatio;
}

export interface TextLayerOptions {
  width: number;
  height: number;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  align: 'left' | 'center' | 'right';
  bold?: boolean;
  letterSpacing?: number;
  /** Contour sombre, pour rester lisible sur un fond clair comme sombre. */
  stroke?: { color: string; width: number };
  /** Ombre portée, alternative douce au contour. */
  shadow?: boolean;
}

const ANCHOR: Record<TextLayerOptions['align'], string> = {
  left: 'start',
  center: 'middle',
  right: 'end',
};

/** Construit un calque SVG transparent contenant une ligne de texte. */
export function buildTextLayer(options: TextLayerOptions): Buffer {
  const {
    width,
    height,
    text,
    x,
    y,
    fontSize,
    color,
    align,
    bold = false,
    letterSpacing = 0,
    stroke,
    shadow = false,
  } = options;

  const filter = shadow
    ? `<filter id="s" x="-20%" y="-20%" width="140%" height="140%">
         <feDropShadow dx="0" dy="${(fontSize * 0.04).toFixed(2)}" stdDeviation="${(
           fontSize * 0.06
         ).toFixed(2)}" flood-color="#000000" flood-opacity="0.65"/>
       </filter>`
    : '';

  const strokeAttrs = stroke
    ? ` stroke="${stroke.color}" stroke-width="${stroke.width}" paint-order="stroke fill" stroke-linejoin="round"`
    : '';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>${filter}</defs>
  <text x="${x}" y="${y}"
        font-family="${FONT_STACK}"
        font-size="${fontSize}"
        font-weight="${bold ? '700' : '400'}"
        letter-spacing="${letterSpacing}"
        fill="${color}"
        text-anchor="${ANCHOR[align]}"
        dominant-baseline="middle"${strokeAttrs}${shadow ? ' filter="url(#s)"' : ''}>${escapeXml(
          text,
        )}</text>
</svg>`;

  return Buffer.from(svg);
}

/** Calque SVG d'un rectangle arrondi plein — sert de fond aux mentions. */
export function buildPillLayer(options: {
  width: number;
  height: number;
  x: number;
  y: number;
  pillWidth: number;
  pillHeight: number;
  radius: number;
  fill: string;
  opacity: number;
}): Buffer {
  const { width, height, x, y, pillWidth, pillHeight, radius, fill, opacity } = options;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect x="${x}" y="${y}" width="${pillWidth}" height="${pillHeight}" rx="${radius}" ry="${radius}" fill="${fill}" fill-opacity="${opacity}"/>
</svg>`;
  return Buffer.from(svg);
}

/**
 * Génère réellement les fichiers d'icônes et les écrans de démarrage iOS.
 *
 * Le cahier des charges insiste : ne pas référencer des fichiers qui n'existent
 * pas. Ce script produit tout ce que `manifest.ts` et `layout.tsx` déclarent, à
 * partir d'un SVG source unique.
 *
 * Usage : pnpm icons
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';

const ICONS_DIR = resolve(process.cwd(), 'public/icons');
const SPLASH_DIR = resolve(process.cwd(), 'public/splash');

const INK = '#0B0B0F';
const ACCENT = '#D6FF3E';

/**
 * Logo source.
 *
 * Un « F » construit géométriquement, plus un point qui évoque le déclencheur
 * d'un appareil photo. Volontairement simple : à 48 px sur un écran d'accueil,
 * tout détail disparaît.
 */
function logoSvg(size: number, options: { padding: number; background: string }): string {
  const { padding, background } = options;
  const inner = size * (1 - padding * 2);
  const offset = size * padding;
  const stroke = inner * 0.17;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${background}"/>
  <g transform="translate(${offset} ${offset})">
    <!-- Barre verticale du F -->
    <rect x="${inner * 0.16}" y="${inner * 0.1}" width="${stroke}" height="${inner * 0.8}" rx="${stroke * 0.3}" fill="${ACCENT}"/>
    <!-- Barre supérieure -->
    <rect x="${inner * 0.16}" y="${inner * 0.1}" width="${inner * 0.56}" height="${stroke}" rx="${stroke * 0.3}" fill="${ACCENT}"/>
    <!-- Barre médiane, plus courte -->
    <rect x="${inner * 0.16}" y="${inner * 0.44}" width="${inner * 0.4}" height="${stroke}" rx="${stroke * 0.3}" fill="${ACCENT}"/>
    <!-- Déclencheur -->
    <circle cx="${inner * 0.78}" cy="${inner * 0.78}" r="${inner * 0.11}" fill="${ACCENT}"/>
  </g>
</svg>`;
}

/** Icône maskable : marge de sécurité de 20 % imposée par Android. */
function maskableSvg(size: number): string {
  return logoSvg(size, { padding: 0.22, background: INK });
}

function standardSvg(size: number): string {
  return logoSvg(size, { padding: 0.14, background: INK });
}

/**
 * Écrans de démarrage iOS — §6.4.
 *
 * Sans ces images, une PWA installée affiche un écran blanc au lancement, ce qui
 * fait immédiatement « site web déguisé ». Avec, le démarrage est indiscernable
 * d'une app native.
 *
 * Les dimensions sont en pixels physiques (points × densité).
 */
const IOS_SPLASH_SCREENS = [
  { name: 'iphone-se', width: 750, height: 1334, ratio: 2 },
  { name: 'iphone-8-plus', width: 1242, height: 2208, ratio: 3 },
  { name: 'iphone-x-xs-11pro', width: 1125, height: 2436, ratio: 3 },
  { name: 'iphone-xr-11', width: 828, height: 1792, ratio: 2 },
  { name: 'iphone-xsmax-11promax', width: 1242, height: 2688, ratio: 3 },
  { name: 'iphone-12-13-14', width: 1170, height: 2532, ratio: 3 },
  { name: 'iphone-12-13-promax', width: 1284, height: 2778, ratio: 3 },
  { name: 'iphone-14-pro', width: 1179, height: 2556, ratio: 3 },
  { name: 'iphone-14-15-promax', width: 1290, height: 2796, ratio: 3 },
  { name: 'ipad-mini-air', width: 1536, height: 2048, ratio: 2 },
  { name: 'ipad-pro-11', width: 1668, height: 2388, ratio: 2 },
  { name: 'ipad-pro-12', width: 2048, height: 2732, ratio: 2 },
] as const;

async function generateSplash(
  width: number,
  height: number,
): Promise<Buffer> {
  // Le logo occupe 30 % de la plus petite dimension : lisible sans écraser.
  const logoSize = Math.round(Math.min(width, height) * 0.3);
  const logo = await sharp(Buffer.from(standardSvg(logoSize))).png().toBuffer();

  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: INK,
    },
  })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toBuffer();
}

async function main(): Promise<void> {
  await mkdir(ICONS_DIR, { recursive: true });
  await mkdir(SPLASH_DIR, { recursive: true });

  console.log('\n🎨 Génération des icônes\n');

  // Favicon SVG : net à toutes les tailles, aucune génération nécessaire.
  await writeFile(resolve(ICONS_DIR, 'favicon.svg'), standardSvg(64));
  console.log('  ✅ favicon.svg');

  for (const size of [192, 512]) {
    const buffer = await sharp(Buffer.from(standardSvg(size))).png().toBuffer();
    await writeFile(resolve(ICONS_DIR, `${size}.png`), buffer);
    console.log(`  ✅ ${size}.png`);
  }

  const maskable = await sharp(Buffer.from(maskableSvg(512))).png().toBuffer();
  await writeFile(resolve(ICONS_DIR, 'maskable-512.png'), maskable);
  console.log('  ✅ maskable-512.png');

  // apple-touch-icon : iOS n'applique pas de masque, mais arrondit lui-même.
  // Pas de transparence, sinon le fond devient noir sur certaines versions.
  const appleTouch = await sharp(Buffer.from(standardSvg(180)))
    .flatten({ background: INK })
    .png()
    .toBuffer();
  await writeFile(resolve(ICONS_DIR, 'apple-touch-icon.png'), appleTouch);
  console.log('  ✅ apple-touch-icon.png (180×180)');

  console.log('\n📱 Génération des écrans de démarrage iOS\n');

  const links: string[] = [];
  for (const screen of IOS_SPLASH_SCREENS) {
    const buffer = await generateSplash(screen.width, screen.height);
    const filename = `${screen.name}-${screen.width}x${screen.height}.png`;
    await writeFile(resolve(SPLASH_DIR, filename), buffer);

    // Largeur/hauteur en POINTS CSS dans la media query, pas en pixels.
    const cssWidth = screen.width / screen.ratio;
    const cssHeight = screen.height / screen.ratio;
    links.push(
      `<link rel="apple-touch-startup-image" href="/splash/${filename}" ` +
        `media="(device-width: ${cssWidth}px) and (device-height: ${cssHeight}px) ` +
        `and (-webkit-device-pixel-ratio: ${screen.ratio}) and (orientation: portrait)" />`,
    );
    console.log(`  ✅ ${filename}`);
  }

  // Le fichier généré est importé par le layout : les balises restent toujours
  // synchronisées avec les images réellement présentes.
  const component = `/**
 * GÉNÉRÉ PAR \`pnpm icons\` — ne pas modifier à la main.
 *
 * Balises d'écran de démarrage iOS. Sans elles, la PWA installée affiche un
 * écran blanc au lancement.
 */
export function IosSplashLinks() {
  return (
    <>
      ${links
        .map((link) => link.replace(/^<link /, '<link ').replace(/\/>$/, '/>'))
        .join('\n      ')}
    </>
  );
}
`;
  await writeFile(resolve(process.cwd(), 'components/pwa/IosSplashLinks.tsx'), component);
  console.log('\n  ✅ components/pwa/IosSplashLinks.tsx');

  console.log(
    `\n─────────────────────────────────────────────\n` +
      `✅ ${2 + 2 + IOS_SPLASH_SCREENS.length} fichiers générés\n` +
      `📁 ${ICONS_DIR}\n` +
      `📁 ${SPLASH_DIR}\n` +
      `─────────────────────────────────────────────\n`,
  );
}

void main();

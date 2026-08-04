/**
 * Vérifie la chaîne de post-traitement SANS aucune clé API.
 *
 * Ce script existe parce que la conformité ne doit pas dépendre d'un
 * fournisseur externe pour être testable : il fabrique une image synthétique,
 * la passe dans `finalizeImage`, puis relit le résultat pour vérifier que
 * chaque garantie annoncée est réellement là.
 *
 * Usage : pnpm test:pipeline
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { finalizeImage } from '../lib/postprocess';
import { getTemplateById, TEMPLATES } from '../lib/templates';

const OUT_DIR = resolve(process.cwd(), 'test-output/pipeline');

let failures = 0;

function check(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`  ✅ ${label}`);
  } else {
    failures += 1;
    console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

/**
 * Image source synthétique : un dégradé avec des zones claires et sombres, pour
 * vérifier que la mention légale reste lisible dans les deux cas.
 */
async function makeSyntheticSource(width: number, height: number): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#ffffff"/>
        <stop offset="50%" stop-color="#7c3aed"/>
        <stop offset="100%" stop-color="#000000"/>
      </linearGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#g)"/>
    <rect x="0" y="${height * 0.8}" width="${width}" height="${height * 0.2}" fill="#ffffff"/>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/** Moyenne de luminance d'une région — sert à prouver qu'un calque a bien été posé. */
async function regionMeanLuminance(
  image: Buffer,
  region: { left: number; top: number; width: number; height: number },
): Promise<number> {
  const { data } = await sharp(image)
    .extract(region)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let sum = 0;
  for (const value of data) sum += value;
  return sum / data.length;
}

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });

  console.log('\n🧪 Test de la chaîne de post-traitement (sans clé API)\n');

  // ── 1. Normalisation du ratio ──────────────────────────────────────────────
  // On fournit du 3:4 (ce que demande le moteur) et on attend du 4:5 exact.
  console.log('1. Normalisation au ratio 4:5');
  const source = await makeSyntheticSource(1200, 1600); // 3:4
  const template = getTemplateById('dans-40-ans');
  if (!template) throw new Error('Template de test introuvable');

  const free = await finalizeImage({
    image: source,
    template,
    aspectRatio: '4:5',
    modelId: 'test-model',
    provider: 'test',
    watermarked: true,
    domain: 'fauxto.com',
  });

  const ratio = free.width / free.height;
  check(
    `Ratio de sortie = 4:5 (obtenu ${free.width}×${free.height}, soit ${ratio.toFixed(4)})`,
    Math.abs(ratio - 0.8) < 0.01,
    `attendu 0.8000`,
  );
  check('Format de sortie JPEG', free.mimeType === 'image/jpeg');
  await writeFile(resolve(OUT_DIR, 'gratuit-avec-filigrane.jpg'), free.image);

  // ── 2. Absence de pastille visible ────────────────────────────────────────
  console.log('\n2. Absence de pastille visible sur l’image');
  // La pastille était sombre et posée en bas à gauche, par-dessus une bande
  // blanche : sa présence faisait chuter nettement la luminance de la zone.
  // On vérifie désormais l'inverse — la zone doit rester claire.
  //
  // La zone mesurée est volontairement ÉTROITE et située là où la pastille se
  // trouvait. Une zone large diluerait le noir dans le blanc environnant et
  // donnerait une moyenne ambiguë, incapable de distinguer « pastille absente »
  // de « pastille présente mais petite ».
  const labelRegion = {
    left: Math.round(free.width * 0.05),
    top: Math.round(free.height * 0.935),
    width: Math.round(free.width * 0.3),
    height: Math.round(free.height * 0.03),
  };
  const labelLuminance = await regionMeanLuminance(free.image, labelRegion);
  check(
    `Aucune pastille en bas à gauche (luminance ${labelLuminance.toFixed(0)}/255, fond blanc intact)`,
    labelLuminance > 200,
    'la zone est sombre : une pastille a été posée alors qu’elle doit être absente',
  );

  // ── 3. Filigrane commercial ───────────────────────────────────────────────
  console.log('\n3. Filigrane commercial (retiré à l’achat)');
  const paid = await finalizeImage({
    image: source,
    template,
    aspectRatio: '4:5',
    modelId: 'test-model',
    provider: 'test',
    watermarked: false,
    domain: 'fauxto.com',
  });
  await writeFile(resolve(OUT_DIR, 'paye-sans-filigrane.jpg'), paid.image);

  check('Version payante marquée sans filigrane', paid.marking.commercialWatermark === false);
  check('Version gratuite marquée avec filigrane', free.marking.commercialWatermark === true);
  // La pastille visible est désactivée : elle levait le doute du destinataire,
  // donc l'objet même du produit. Ce qui doit rester vérifié, c'est que le
  // marquage MACHINE tient — c'est lui qui porte l'obligation du fournisseur.
  check(
    'La pastille visible est absente des DEUX versions',
    free.marking.legalLabel === false && paid.marking.legalLabel === false,
  );
  check(
    'Le manifeste C2PA est apposé sur les DEUX versions',
    free.marking.c2paApplied === true && paid.marking.c2paApplied === true,
  );

  // Le filigrane répété doit rendre la version gratuite mesurablement différente
  // au centre de l'image, là où la mention légale n'intervient pas.
  const centre = {
    left: Math.round(free.width * 0.25),
    top: Math.round(free.height * 0.3),
    width: Math.round(free.width * 0.5),
    height: Math.round(free.height * 0.2),
  };
  const freeCentre = await regionMeanLuminance(free.image, centre);
  const paidCentre = await regionMeanLuminance(paid.image, centre);
  check(
    `Filigrane visible au centre (gratuit ${freeCentre.toFixed(1)} vs payant ${paidCentre.toFixed(1)})`,
    Math.abs(freeCentre - paidCentre) > 1,
    'aucune différence mesurable entre les deux versions',
  );

  // ── 4. Métadonnées C2PA ───────────────────────────────────────────────────
  console.log('\n4. Métadonnées de provenance C2PA');
  check(
    `Signature appliquée (signataire : ${free.marking.c2paSigner})`,
    free.marking.c2paApplied,
    free.marking.c2paError,
  );

  if (free.marking.c2paApplied) {
    const { createC2pa } = await import('c2pa-node');
    const c2pa = createC2pa();
    const store = await c2pa.read({ buffer: free.image, mimeType: 'image/jpeg' });
    check('Manifeste relu depuis le fichier exporté', store !== null);

    if (store) {
      // `ResolvedManifestStore.active_manifest` est directement le manifeste
      // résolu (snake_case), pas une clé dans `manifests`.
      const active = store.active_manifest;
      check(
        `Générateur déclaré (${active?.claim_generator ?? 'absent'})`,
        Boolean(active?.claim_generator?.includes('Fauxto')),
      );
      const assertions = (active?.assertions ?? []) as { label?: string; data?: unknown }[];
      const actions = assertions.find((entry) => entry.label === 'c2pa.actions');
      const data = actions?.data as
        | { actions?: { digitalSourceType?: string; softwareAgent?: string }[] }
        | undefined;
      const sourceType = data?.actions?.[0]?.digitalSourceType ?? '';
      check(
        'Type de source IPTC = trainedAlgorithmicMedia (marqueur IA standard)',
        sourceType.includes('trainedAlgorithmicMedia'),
        `obtenu « ${sourceType} »`,
      );
    }
  }

  // ── 5. Incrustation de texte (templates 5 et 9) ────────────────────────────
  console.log('\n5. Incrustation de texte serveur (chèque et magazine)');
  const withText = TEMPLATES.filter((t) => t.textOverlays?.length);
  check(
    `Deux templates utilisent l’incrustation (${withText.map((t) => t.id).join(', ')})`,
    withText.length === 2,
  );

  for (const t of withText) {
    const result = await finalizeImage({
      image: source,
      template: t,
      aspectRatio: t.aspectRatio,
      modelId: 'test-model',
      provider: 'test',
      watermarked: false,
      domain: 'fauxto.com',
      overlayInputs: { 0: 'Kevin' },
    });
    await writeFile(resolve(OUT_DIR, `texte-${t.id}.jpg`), result.image);
    check(`« ${t.nameFr} » produit une image valide`, result.bytes > 1000);
  }

  // ── 6. Robustesse ─────────────────────────────────────────────────────────
  console.log('\n6. Robustesse');
  const square = await makeSyntheticSource(1024, 1024);
  const fromSquare = await finalizeImage({
    image: square,
    template,
    aspectRatio: '4:5',
    modelId: 'test-model',
    provider: 'test',
    watermarked: true,
    domain: 'fauxto.com',
  });
  check(
    `Une source carrée est ramenée en 4:5 (${fromSquare.width}×${fromSquare.height})`,
    Math.abs(fromSquare.width / fromSquare.height - 0.8) < 0.01,
  );

  const tall = await makeSyntheticSource(900, 1600); // 9:16
  const fromTall = await finalizeImage({
    image: tall,
    template,
    aspectRatio: '9:16',
    modelId: 'test-model',
    provider: 'test',
    watermarked: true,
    domain: 'fauxto.com',
  });
  check(
    `Un ratio 9:16 est conservé (${fromTall.width}×${fromTall.height})`,
    Math.abs(fromTall.width / fromTall.height - 9 / 16) < 0.01,
  );

  console.log('\n─────────────────────────────────────────────');
  if (failures === 0) {
    console.log(`✅ Toutes les vérifications passent.`);
  } else {
    console.log(`❌ ${failures} vérification(s) en échec.`);
  }
  console.log(`📁 Images produites dans ${OUT_DIR}`);
  console.log('─────────────────────────────────────────────\n');

  process.exit(failures === 0 ? 0 : 1);
}

void main();

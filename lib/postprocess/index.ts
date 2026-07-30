import 'server-only';
import sharp from 'sharp';
import type { AspectRatio } from '@/lib/image-engine/types';
import type { PrankTemplate } from '@/lib/templates';
import { embedC2paManifest } from './c2pa';
import {
  applyCommercialWatermark,
  applyLegalLabel,
  normalizeAspectRatio,
} from './marking';
import { applyTextOverlays, type OverlayInputs } from './text-overlay';

export { LEGAL_LABEL_FR } from './marking';
export { userInputSlots } from './text-overlay';
export type { OverlayInputs } from './text-overlay';

/**
 * Format de livraison. On travaille en PNG sur toute la chaîne pour ne pas
 * abîmer le watermark SynthID à chaque étape, et on ne compresse qu'une seule
 * fois, à la fin. JPEG 92 parce que c'est ce que WhatsApp et Snapchat avalent
 * le mieux, et que SynthID est conçu pour y survivre.
 */
const EXPORT_MIME = 'image/jpeg';
const EXPORT_QUALITY = 92;

export interface FinalizeInput {
  /** Sortie brute du fournisseur. */
  image: Buffer;
  template: PrankTemplate;
  aspectRatio: AspectRatio;
  modelId: string;
  provider: string;
  /** Faux uniquement si l'utilisateur a payé. */
  watermarked: boolean;
  /** Nom de domaine du filigrane commercial. */
  domain: string;
  /** Saisies pour les templates à texte incrusté (chèque, magazine). */
  overlayInputs?: OverlayInputs;
}

export interface FinalizeResult {
  image: Buffer;
  mimeType: string;
  width: number;
  height: number;
  bytes: number;
  /** État du marquage, à écrire en base pour traçabilité. */
  marking: {
    legalLabel: true;
    commercialWatermark: boolean;
    c2paApplied: boolean;
    c2paSigner: 'production' | 'test' | 'none';
    c2paError?: string;
  };
}

/**
 * Chaîne de post-traitement complète, du buffer fournisseur au fichier livrable.
 *
 * L'ordre n'est pas arbitraire :
 *   1. recadrage au ratio exact, avant tout ajout, sinon les incrustations
 *      seraient rognées ;
 *   2. texte du template, qui fait partie de l'image « utile » ;
 *   3. mention légale, TOUJOURS, jamais conditionnée à quoi que ce soit ;
 *   4. filigrane commercial, seul élément que l'achat retire ;
 *   5. compression unique ;
 *   6. signature C2PA en dernier, sur le fichier définitif — sinon la
 *      compression invaliderait le manifeste.
 */
export async function finalizeImage(input: FinalizeInput): Promise<FinalizeResult> {
  let buffer = await normalizeAspectRatio(input.image, input.aspectRatio);

  if (input.template.textOverlays?.length) {
    buffer = await applyTextOverlays(buffer, input.template, input.overlayInputs ?? {});
  }

  buffer = await applyLegalLabel(buffer);

  if (input.watermarked) {
    buffer = await applyCommercialWatermark(buffer, input.domain);
  }

  const exported = await sharp(buffer, { failOn: 'none' })
    .jpeg({ quality: EXPORT_QUALITY, mozjpeg: true, chromaSubsampling: '4:4:4' })
    .toBuffer({ resolveWithObject: true });

  const signed = await embedC2paManifest({
    image: exported.data,
    mimeType: EXPORT_MIME,
    modelId: input.modelId,
    provider: input.provider,
    templateNameFr: input.template.nameFr,
  });

  return {
    image: signed.image,
    mimeType: EXPORT_MIME,
    width: exported.info.width,
    height: exported.info.height,
    bytes: signed.image.byteLength,
    marking: {
      legalLabel: true,
      commercialWatermark: input.watermarked,
      c2paApplied: signed.applied,
      c2paSigner: signed.signerKind,
      c2paError: signed.error,
    },
  };
}

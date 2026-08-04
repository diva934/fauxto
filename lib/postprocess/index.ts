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

/**
 * Pastille « Image générée par IA » incrustée dans les pixels.
 *
 * DÉSACTIVÉE. Le produit repose sur le doute du destinataire : une mention
 * visible sur l'image le lève instantanément et vide le produit de son objet.
 *
 * Ce que ça ne change pas — le marquage MACHINE reste intégral, et c'est lui
 * qui porte l'obligation du fournisseur d'un système génératif :
 *   · manifeste C2PA signé, avec l'action `trainedAlgorithmicMedia` ;
 *   · métadonnées IPTC de média synthétique ;
 *   · filigrane SynthID, apposé par le modèle et indissociable des pixels.
 *
 * Ce que ça déplace — l'obligation de DIRE qu'une image est générée, au moment
 * de la diffuser, revient alors entièrement à la personne qui l'envoie. Le
 * produit ne la remplit plus à sa place. Les CGU doivent le dire clairement.
 *
 * Repasser à `true` restaure la pastille sans autre modification.
 */
const VISIBLE_LEGAL_LABEL = false;

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
    /** Pastille visible. Fausse tant que `VISIBLE_LEGAL_LABEL` l'est. */
    legalLabel: boolean;
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
 *   3. pastille visible, désormais désactivée — voir `VISIBLE_LEGAL_LABEL` ;
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

  if (VISIBLE_LEGAL_LABEL) {
    buffer = await applyLegalLabel(buffer);
  }

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
      legalLabel: VISIBLE_LEGAL_LABEL,
      commercialWatermark: input.watermarked,
      c2paApplied: signed.applied,
      c2paSigner: signed.signerKind,
      c2paError: signed.error,
    },
  };
}

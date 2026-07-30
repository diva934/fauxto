/**
 * Frontière d'isolation du fournisseur de génération d'images.
 *
 * RÈGLE ABSOLUE : aucun fichier hors de `lib/image-engine/` ne doit importer
 * `@google/genai` ni aucun autre SDK de modèle. Le jour où le prix ou la
 * qualité change, brancher fal.ai ou Replicate ne doit coûter qu'une classe.
 */

/** Ratios exposés au produit. Ce ne sont PAS forcément ceux du fournisseur. */
export type AspectRatio = '1:1' | '4:5' | '9:16';

export interface EditInput {
  sourceImage: Buffer;
  /** MIME de l'image source. Défaut : image/jpeg. */
  sourceMimeType?: string;
  /** Prompt d'édition, en anglais — les modèles y réagissent mieux. */
  prompt: string;
  aspectRatio: AspectRatio;
  /** Identifiant de modèle imposé par le template (rendu de texte = modèle Pro). */
  modelId?: string;
}

export interface EditOutput {
  image: Buffer;
  /** MIME réellement renvoyé par le fournisseur. */
  mimeType: string;
  provider: string;
  modelId: string;
  /** Durée de l'appel fournisseur, en millisecondes. */
  latencyMs: number;
}

export interface ImageEngine {
  readonly provider: string;
  edit(input: EditInput): Promise<EditOutput>;
}

/**
 * Analyse brute d'une image source, telle que renvoyée par le modèle de vision.
 *
 * Ce type ne porte AUCUNE décision : ce sont des observations. La politique de
 * refus (seuils, doute, messages) vit dans `lib/moderation/`, pour que changer
 * de fournisseur n'oblige pas à réécrire les règles juridiques.
 */
export interface VisionAnalysis {
  containsPerson: boolean;
  /** Âge minimum estimé parmi les personnes visibles. `null` si aucune. */
  estimatedMinAge: number | null;
  minorLikelihood: 'none' | 'low' | 'medium' | 'high';
  nudityOrSexual: boolean;
  publicFigure: boolean;
  publicFigureName: string | null;
  /** Criminalité, maladie, décès, violence — cf. §7.2 du cahier des charges. */
  harmfulContext: boolean;
  confidence: 'low' | 'medium' | 'high';
  notes: string;
}

export interface ModerationEngine {
  readonly provider: string;
  analyze(input: { image: Buffer; mimeType: string }): Promise<VisionAnalysis>;
}

/**
 * Erreur normalisée pour que l'appelant n'ait jamais à connaître le
 * vocabulaire d'erreur d'un fournisseur particulier.
 */
export type EngineErrorCode =
  /** Le fournisseur a refusé le contenu (filtre de sécurité côté modèle). */
  | 'blocked'
  /** Quota ou limite de débit du fournisseur. */
  | 'rate_limited'
  /** Le modèle n'a renvoyé aucune image exploitable. */
  | 'no_image'
  /** Délai dépassé. */
  | 'timeout'
  /** Panne ou réponse inattendue. */
  | 'provider_error'
  /** Configuration absente ou invalide. */
  | 'misconfigured';

export class EngineError extends Error {
  readonly code: EngineErrorCode;
  readonly provider: string;
  readonly retryable: boolean;

  constructor(
    code: EngineErrorCode,
    provider: string,
    message: string,
    options?: { cause?: unknown; retryable?: boolean },
  ) {
    super(message, { cause: options?.cause });
    this.name = 'EngineError';
    this.code = code;
    this.provider = provider;
    this.retryable = options?.retryable ?? (code === 'rate_limited' || code === 'timeout');
  }

  /** Message court en français, affichable tel quel à l'utilisateur. */
  get userMessageFr(): string {
    switch (this.code) {
      case 'blocked':
        return "Le modèle a refusé cette photo. Essaie avec une autre image.";
      case 'rate_limited':
        return 'Trop de monde en ce moment. Réessaie dans quelques secondes.';
      case 'no_image':
        return "La génération n'a rien donné. Réessaie, ça arrive.";
      case 'timeout':
        return "Ça a pris trop de temps. Ton crédit n'a pas été débité.";
      case 'misconfigured':
        return 'Service temporairement indisponible.';
      case 'provider_error':
      default:
        return "Un problème est survenu. Ton crédit n'a pas été débité.";
    }
  }
}

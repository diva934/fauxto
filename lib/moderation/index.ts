import 'server-only';
import { GeminiModerationEngine } from '@/lib/image-engine/gemini-moderation';
import { EngineError, type ModerationEngine, type VisionAnalysis } from '@/lib/image-engine/types';

/**
 * Politique de modération — §7.2 du cahier des charges.
 *
 * Ce fichier ne parle à aucun SDK : il applique des règles à une `VisionAnalysis`
 * fournie par la couche moteur. Changer de fournisseur de vision ne doit jamais
 * obliger à rouvrir les règles juridiques.
 *
 * Principe directeur : FAIL-CLOSED. Toute erreur, tout doute, toute analyse
 * incomplète produit un refus. Un faux refus coûte une conversion ; un faux
 * accord coûte beaucoup plus cher.
 */

/** Valeurs écrites dans `generations.moderation_flag`. */
export type ModerationFlag =
  | 'minor'
  | 'sexual_content'
  | 'public_figure'
  | 'harmful_context'
  | 'low_confidence'
  | 'analysis_failed';

export type ModerationDecision =
  | { allowed: true; analysis: VisionAnalysis }
  | {
      allowed: false;
      flag: ModerationFlag;
      /** Message affichable tel quel, en français, tutoiement. */
      messageFr: string;
      analysis: VisionAnalysis | null;
    };

/**
 * Seuil d'âge de sécurité.
 *
 * On refuse en dessous de 25 ans estimés, pas 18. L'estimation d'âge par un
 * modèle a une marge d'erreur de plusieurs années, et le brief est explicite :
 * « En cas de doute, refuse. Aucune exception. » Une marge de 7 ans absorbe
 * l'erreur du modèle dans le sens qui protège.
 */
const SAFE_AGE_THRESHOLD = 25;

const MESSAGES: Record<ModerationFlag, string> = {
  minor:
    "On ne peut pas traiter cette photo : la personne semble mineure, ou son âge n'est pas certain. C'est une limite qu'on ne contourne pas.",
  sexual_content:
    'Cette photo contient du contenu que le service ne traite pas. Choisis une autre image.',
  public_figure:
    "Cette photo semble représenter une personne connue. On ne modifie que des photos de gens de ton entourage — c'est une question de droit à l'image.",
  harmful_context:
    "Cette photo évoque un contexte trop sensible (accident, maladie, violence). On reste sur des canulars inoffensifs.",
  low_confidence:
    "L'image est trop floue ou trop sombre pour qu'on puisse la vérifier. Réessaie avec une photo plus nette.",
  analysis_failed:
    "On n'a pas pu vérifier cette photo. Réessaie dans un instant — ton crédit n'a pas été débité.",
};

let cachedEngine: ModerationEngine | null = null;

function engine(): ModerationEngine {
  if (!cachedEngine) cachedEngine = new GeminiModerationEngine();
  return cachedEngine;
}

/** Applique les règles à une analyse déjà obtenue. Pur, testable isolément. */
export function decide(analysis: VisionAnalysis): ModerationDecision {
  const refuse = (flag: ModerationFlag): ModerationDecision => ({
    allowed: false,
    flag,
    messageFr: MESSAGES[flag],
    analysis,
  });

  // 1. Nudité et contenu sexuel : refus sec, indépendamment de tout le reste.
  if (analysis.nudityOrSexual) return refuse('sexual_content');

  // 2. Mineurs. Trois barrières indépendantes, parce qu'une seule ne suffit pas.
  if (analysis.containsPerson) {
    if (analysis.minorLikelihood === 'high' || analysis.minorLikelihood === 'medium') {
      return refuse('minor');
    }
    if (analysis.estimatedMinAge === null) {
      // Une personne est visible mais le modèle n'a pas su estimer son âge.
      // C'est exactement le cas « en cas de doute ».
      return refuse('minor');
    }
    if (analysis.estimatedMinAge < SAFE_AGE_THRESHOLD) {
      return refuse('minor');
    }
  }

  // 3. Personnalités publiques : zone juridiquement la plus exposée.
  if (analysis.publicFigure) return refuse('public_figure');

  // 4. Criminalité, maladie, décès, violence.
  if (analysis.harmfulContext) return refuse('harmful_context');

  // 5. Confiance globale insuffisante : on ne valide pas une image qu'on n'a
  //    pas réellement pu examiner.
  if (analysis.confidence === 'low') return refuse('low_confidence');

  return { allowed: true, analysis };
}

/**
 * Analyse puis décide. Toute exception devient un refus `analysis_failed` :
 * c'est le cœur du fail-closed.
 */
export async function moderateSourceImage(input: {
  image: Buffer;
  mimeType: string;
}): Promise<ModerationDecision> {
  try {
    const analysis = await engine().analyze(input);
    return decide(analysis);
  } catch (cause) {
    const detail = cause instanceof EngineError ? `${cause.code}: ${cause.message}` : String(cause);
    console.error('[moderation] Analyse impossible, refus par défaut —', detail);
    return {
      allowed: false,
      flag: 'analysis_failed',
      messageFr: MESSAGES.analysis_failed,
      analysis: null,
    };
  }
}

export { MESSAGES as MODERATION_MESSAGES_FR, SAFE_AGE_THRESHOLD };

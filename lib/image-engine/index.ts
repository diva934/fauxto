import 'server-only';
import { DEFAULT_MODEL, GeminiEngine, PRO_MODEL } from './gemini';
import type { ModelTier } from '@/lib/templates';
import type { ImageEngine } from './types';

export { DEFAULT_MODEL, PRO_MODEL } from './gemini';
export { EngineError } from './types';
export type {
  AspectRatio,
  EditInput,
  EditOutput,
  EngineErrorCode,
  ImageEngine,
} from './types';

let cached: ImageEngine | null = null;

/**
 * Point d'entrée unique vers le fournisseur d'images.
 *
 * Pour basculer sur fal.ai ou Replicate : écris une classe qui implémente
 * `ImageEngine`, et change le `new GeminiEngine()` ci-dessous. Rien d'autre
 * dans l'application ne connaît le fournisseur.
 */
export function getImageEngine(): ImageEngine {
  if (!cached) cached = new GeminiEngine();
  return cached;
}

/**
 * Traduit le palier abstrait demandé par un template en identifiant concret.
 * C'est le seul endroit qui fait ce lien — `lib/templates.ts` reste agnostique
 * du fournisseur et peut donc être importé par des composants client.
 */
export function resolveModelId(tier: ModelTier): string {
  return tier === 'pro' ? PRO_MODEL : DEFAULT_MODEL;
}

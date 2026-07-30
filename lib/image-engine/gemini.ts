import 'server-only';
import { GoogleGenAI } from '@google/genai';
import { serverEnv } from '@/lib/env';
import {
  EngineError,
  type AspectRatio,
  type EditInput,
  type EditOutput,
  type ImageEngine,
} from './types';

const PROVIDER = 'google';

/**
 * Modèles, surchargeables sans redéploiement.
 *
 * Même raison que pour la modération : un identifiant de modèle est la donnée
 * la plus volatile du système. Pouvoir en changer par variable d'environnement
 * permet de corriger à chaud, et de comparer deux modèles en production sans
 * toucher au code.
 */
/**
 * Modèle par défaut : la variante Lite.
 *
 * Mesuré le 30/07/2026 sur la même photo source et les mêmes prompts :
 *
 *   gemini-3.1-flash-image        médiane 21,4 s · pire cas 23,8 s · 2 échecs/10
 *   gemini-3.1-flash-lite-image   médiane  3,6 s · pire cas 11,2 s · 0 échec/3
 *
 * Soit environ 6× plus rapide, et moins cher par génération. Surtout, c'est le
 * seul des deux qui tient la promesse affichée sur le site (« dix secondes ») :
 * avec le modèle standard, la page annonçait dix secondes et en mettait vingt.
 *
 * Réversible sans redéploiement via `GEMINI_IMAGE_MODEL` si la qualité déçoit
 * à l'usage.
 */
export const DEFAULT_MODEL =
  process.env.GEMINI_IMAGE_MODEL?.trim() || 'gemini-3.1-flash-lite-image';
/** Modèle Pro : réservé aux templates qui exigent un rendu de mise en page fin. */
export const PRO_MODEL =
  process.env.GEMINI_IMAGE_PRO_MODEL?.trim() || 'gemini-3-pro-image';

/**
 * Délai d'abandon côté fournisseur.
 *
 * Mesuré le 30/07/2026 sur les 10 templates : médiane 21,4 s, pire cas 23,8 s,
 * et 2 générations sur 10 perdues en 504 DEADLINE_EXCEEDED. À 25 s, le plafond
 * passait sous la latence réelle : les échecs n'étaient pas accidentels, ils
 * étaient structurels.
 *
 * 45 s laisse une marge franche au-dessus du pire cas observé, tout en restant
 * sous le `maxDuration: 60` de la fonction Vercel — au-delà, c'est la
 * plateforme qui coupe, et l'utilisateur perd la réponse sans message clair.
 *
 * ⚠️ Ce délai est un filet de sécurité, PAS une promesse produit. Les textes
 * du site annoncent dix secondes : cet écart est un problème de produit à
 * trancher, pas un réglage à masquer ici.
 */
const PROVIDER_TIMEOUT_MS = 45_000;

/**
 * Ratios réellement documentés par `ImageConfig` du SDK :
 * "1:1", "2:3", "3:2", "3:4", "4:3", "9:16", "16:9", "21:9".
 *
 * `4:5` n'y figure pas. On demande donc le plus proche (`3:4`) et on
 * normalise au ratio exact avec sharp en post-traitement — c'est
 * déterministe et ça ne dépend pas d'un comportement non documenté.
 *
 * Si tu vérifies un jour que l'API accepte "4:5" nativement, il suffit de
 * changer cette seule ligne : le post-traitement restera correct.
 */
const PROVIDER_ASPECT_RATIO: Record<AspectRatio, string> = {
  '1:1': '1:1',
  '4:5': '3:4',
  '9:16': '9:16',
};

let cachedClient: GoogleGenAI | null = null;

function client(): GoogleGenAI {
  if (!cachedClient) {
    try {
      cachedClient = new GoogleGenAI({ apiKey: serverEnv.geminiApiKey });
    } catch (cause) {
      throw new EngineError('misconfigured', PROVIDER, 'GEMINI_API_KEY absente', { cause });
    }
  }
  return cachedClient;
}

/** Traduit une erreur SDK/HTTP en `EngineError` normalisée. */
function normalizeError(cause: unknown): EngineError {
  const message = cause instanceof Error ? cause.message : String(cause);
  const lower = message.toLowerCase();

  if (lower.includes('abort') || lower.includes('timeout') || lower.includes('deadline')) {
    return new EngineError('timeout', PROVIDER, message, { cause });
  }
  if (lower.includes('429') || lower.includes('quota') || lower.includes('rate limit')) {
    return new EngineError('rate_limited', PROVIDER, message, { cause });
  }
  if (lower.includes('safety') || lower.includes('blocked') || lower.includes('prohibited')) {
    return new EngineError('blocked', PROVIDER, message, { cause });
  }
  if (lower.includes('api key') || lower.includes('unauthorized') || lower.includes('401')) {
    return new EngineError('misconfigured', PROVIDER, message, { cause });
  }
  return new EngineError('provider_error', PROVIDER, message, { cause });
}

export class GeminiEngine implements ImageEngine {
  readonly provider = PROVIDER;

  async edit(input: EditInput): Promise<EditOutput> {
    const modelId = input.modelId ?? DEFAULT_MODEL;
    const sourceMimeType = input.sourceMimeType ?? 'image/jpeg';
    const startedAt = Date.now();

    // Le timeout est porté à la fois par un AbortSignal (coupe le socket) et par
    // httpOptions.timeout (garde-fou côté SDK). Les deux, parce qu'un seul des
    // deux qui échoue laisserait la requête pendre indéfiniment.
    const abortController = new AbortController();
    const timer = setTimeout(() => abortController.abort(), PROVIDER_TIMEOUT_MS);

    try {
      const response = await client().models.generateContent({
        model: modelId,
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  data: input.sourceImage.toString('base64'),
                  mimeType: sourceMimeType,
                },
              },
              { text: input.prompt },
            ],
          },
        ],
        config: {
          responseModalities: ['IMAGE'],
          imageConfig: {
            aspectRatio: PROVIDER_ASPECT_RATIO[input.aspectRatio],
          },
          abortSignal: abortController.signal,
          httpOptions: { timeout: PROVIDER_TIMEOUT_MS },
        },
      });

      const candidate = response.candidates?.[0];

      // Un refus côté modèle ne lève pas d'exception : il revient comme un
      // candidat sans image, avec un finishReason explicite.
      const finishReason = candidate?.finishReason;
      if (finishReason && !['STOP', 'MAX_TOKENS'].includes(String(finishReason))) {
        throw new EngineError(
          'blocked',
          PROVIDER,
          `Génération interrompue par le fournisseur (${String(finishReason)})`,
        );
      }
      if (response.promptFeedback?.blockReason) {
        throw new EngineError(
          'blocked',
          PROVIDER,
          `Prompt refusé (${String(response.promptFeedback.blockReason)})`,
        );
      }

      const imagePart = candidate?.content?.parts?.find(
        (part) => part.inlineData?.data && part.inlineData.mimeType?.startsWith('image/'),
      );

      if (!imagePart?.inlineData?.data) {
        throw new EngineError('no_image', PROVIDER, "Le modèle n'a renvoyé aucune image");
      }

      return {
        image: Buffer.from(imagePart.inlineData.data, 'base64'),
        mimeType: imagePart.inlineData.mimeType ?? 'image/png',
        provider: PROVIDER,
        modelId,
        latencyMs: Date.now() - startedAt,
      };
    } catch (cause) {
      throw cause instanceof EngineError ? cause : normalizeError(cause);
    } finally {
      clearTimeout(timer);
    }
  }
}

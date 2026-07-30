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

/** Modèle par défaut : rapide et bon marché, pour 8 des 10 templates. */
export const DEFAULT_MODEL = 'gemini-3.1-flash-image';
/** Modèle Pro : réservé aux templates qui exigent un rendu de mise en page fin. */
export const PRO_MODEL = 'gemini-3-pro-image';

/** Au-delà, on abandonne et on ne débite pas l'utilisateur (cf. §3.4 du cahier des charges). */
const PROVIDER_TIMEOUT_MS = 25_000;

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

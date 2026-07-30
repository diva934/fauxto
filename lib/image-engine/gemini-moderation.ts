import 'server-only';
import { GoogleGenAI, Type } from '@google/genai';
import sharp from 'sharp';
import { z } from 'zod';
import { serverEnv } from '@/lib/env';
import { EngineError, type ModerationEngine, type VisionAnalysis } from './types';

const PROVIDER = 'google';

/**
 * Modèle de vision pour l'analyse de l'image source.
 *
 * Vérifié le 30/07/2026 contre le catalogue officiel
 * (https://ai.google.dev/gemini-api/docs/models) : `gemini-3.1-flash` — la
 * valeur issue du cahier des charges — N'EXISTE PAS. La famille 3.1 ne propose
 * que `gemini-3.1-flash-lite`, `-flash-image`, `-flash-lite-image`,
 * `-flash-live-preview` et `-flash-tts-preview`.
 *
 * Comme la modération est fail-closed, un identifiant introuvable faisait
 * refuser 100 % des générations sans indice sur la cause. Le défaut est donc
 * `gemini-3.6-flash` (stable, multimodal), toujours surchargeable par
 * `GEMINI_MODERATION_MODEL` sans redéploiement — p. ex. `gemini-3.5-flash-lite`
 * (5× moins cher en entrée) une fois le taux de faux refus mesuré.
 */
const DEFAULT_MODERATION_MODEL =
  process.env.GEMINI_MODERATION_MODEL?.trim() || 'gemini-3.6-flash';

/**
 * La modération doit être rapide : elle s'ajoute au temps d'attente perçu, et
 * elle est SÉRIELLE avant la génération. Budget total annoncé à l'utilisateur :
 * 12 s visées, 25 s d'abandon.
 *
 * Constaté en conditions réelles : à 10 s, une photo pleine résolution fait
 * expirer l'appel (504 DEADLINE_EXCEEDED côté Gemini). Comme la modération est
 * fail-closed, cela REFUSAIT la génération d'un utilisateur légitime.
 */
const MODERATION_TIMEOUT_MS = 15_000;

/**
 * Côté le plus long de l'image envoyée au classificateur.
 *
 * C'est le correctif de fond, pas le délai : estimer un âge et détecter de la
 * nudité ne demande pas une image pleine résolution. Descendre à 512 px divise
 * l'envoi par ~10, accélère l'inférence, et réduit le coût en tokens d'entrée —
 * sans dégrader la décision, qui porte sur des caractéristiques grossières.
 *
 * L'image RÉDUITE ne sert QU'À la modération. La génération reçoit toujours
 * l'originale.
 */
const MODERATION_MAX_EDGE = 512;

/** Une seule reprise, réservée aux échecs manifestement transitoires. */
const RETRYABLE_CODES = new Set(['timeout', 'provider_error']);

const ANALYSIS_PROMPT = `You are an image safety classifier for a photo-editing service. Analyse the image and report only what you can actually observe. Do not speculate.

Report:
- containsPerson: is at least one human face or body visible?
- estimatedMinAge: the age in years of the YOUNGEST person visible. Be conservative: if someone could plausibly be under 18, report the lower estimate. null if no person.
- minorLikelihood: how likely is it that any visible person is under 18?
- nudityOrSexual: is there nudity, underwear-only clothing, or sexually suggestive content?
- publicFigure: is any visible person a recognisable public figure (celebrity, politician, athlete, influencer)?
- publicFigureName: their name if you recognise one, else null.
- harmfulContext: does the image depict or strongly suggest crime, arrest, illness, hospitalisation, injury, death, weapons, or violence?
- confidence: your overall confidence in this assessment. Use "low" if the image is blurry, dark, heavily cropped, or the faces are unclear.
- notes: one short sentence describing what you see.

Be strict about age. A conservative under-estimate is the correct behaviour.`;

const analysisSchema = z.object({
  containsPerson: z.boolean(),
  estimatedMinAge: z.number().nullable(),
  minorLikelihood: z.enum(['none', 'low', 'medium', 'high']),
  nudityOrSexual: z.boolean(),
  publicFigure: z.boolean(),
  publicFigureName: z.string().nullable(),
  harmfulContext: z.boolean(),
  confidence: z.enum(['low', 'medium', 'high']),
  notes: z.string(),
});

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

/**
 * Réduit l'image pour l'appel de modération.
 *
 * `withoutEnlargement` évite d'agrandir une petite image, ce qui n'apporterait
 * rien et coûterait des tokens. En cas d'échec on renvoie l'original : mieux
 * vaut une modération lente qu'une modération absente.
 */
async function downscaleForModeration(
  image: Buffer,
): Promise<{ data: Buffer; mimeType: string }> {
  try {
    const data = await sharp(image, { failOn: 'none' })
      .rotate() // applique l'orientation EXIF : un visage à l'envers se classe mal
      .resize({
        width: MODERATION_MAX_EDGE,
        height: MODERATION_MAX_EDGE,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 80 })
      .toBuffer();
    return { data, mimeType: 'image/jpeg' };
  } catch (cause) {
    console.warn('[moderation] Réduction impossible, envoi de l’original :', cause);
    return { data: image, mimeType: 'image/jpeg' };
  }
}

export class GeminiModerationEngine implements ModerationEngine {
  readonly provider = PROVIDER;

  async analyze(input: { image: Buffer; mimeType: string }): Promise<VisionAnalysis> {
    const reduced = await downscaleForModeration(input.image);

    try {
      return await this.attempt(reduced);
    } catch (cause) {
      // Une reprise unique, et UNIQUEMENT sur des échecs transitoires. Ça ne
      // relâche pas le fail-closed : si la reprise échoue aussi, l'exception
      // remonte et `moderateSourceImage` transforme ça en refus. Sans cette
      // reprise, un simple 504 passager refusait la photo d'un client payant.
      if (cause instanceof EngineError && RETRYABLE_CODES.has(cause.code)) {
        console.warn(`[moderation] ${cause.code} — une reprise.`);
        return await this.attempt(reduced);
      }
      throw cause;
    }
  }

  private async attempt(input: { data: Buffer; mimeType: string }): Promise<VisionAnalysis> {
    const abortController = new AbortController();
    const timer = setTimeout(() => abortController.abort(), MODERATION_TIMEOUT_MS);

    try {
      const response = await client().models.generateContent({
        model: DEFAULT_MODERATION_MODEL,
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  data: input.data.toString('base64'),
                  mimeType: input.mimeType,
                },
              },
              { text: ANALYSIS_PROMPT },
            ],
          },
        ],
        config: {
          // `temperature` (ainsi que top_p / top_k) est déprécié depuis
          // Gemini 3.6 Flash : l'API l'IGNORE aujourd'hui et renverra une 400
          // sur les prochaines générations de modèles. Il donnait donc une
          // fausse impression de déterminisme sur une décision qui a des
          // conséquences juridiques. Le déterminisme passe désormais par une
          // system instruction explicite.
          // cf. https://ai.google.dev/gemini-api/docs/latest-model
          systemInstruction:
            'You are a deterministic classifier. For identical input you must always produce identical output. Report only directly observable facts, never inferences or speculation. When the image is ambiguous, unclear, blurry or partially visible, lower the confidence field rather than guessing.',
          // Sortie structurée : on ne parse pas du texte libre pour une
          // décision qui a des conséquences juridiques.
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              containsPerson: { type: Type.BOOLEAN },
              estimatedMinAge: { type: Type.NUMBER, nullable: true },
              minorLikelihood: {
                type: Type.STRING,
                enum: ['none', 'low', 'medium', 'high'],
              },
              nudityOrSexual: { type: Type.BOOLEAN },
              publicFigure: { type: Type.BOOLEAN },
              publicFigureName: { type: Type.STRING, nullable: true },
              harmfulContext: { type: Type.BOOLEAN },
              confidence: { type: Type.STRING, enum: ['low', 'medium', 'high'] },
              notes: { type: Type.STRING },
            },
            required: [
              'containsPerson',
              'minorLikelihood',
              'nudityOrSexual',
              'publicFigure',
              'harmfulContext',
              'confidence',
              'notes',
            ],
          },
          abortSignal: abortController.signal,
          httpOptions: { timeout: MODERATION_TIMEOUT_MS },
        },
      });

      const text = response.text;
      if (!text) {
        throw new EngineError('no_image', PROVIDER, "Analyse vide renvoyée par le modèle");
      }

      const parsed = analysisSchema.safeParse(JSON.parse(text));
      if (!parsed.success) {
        throw new EngineError(
          'provider_error',
          PROVIDER,
          `Analyse illisible : ${parsed.error.message}`,
        );
      }

      return parsed.data;
    } catch (cause) {
      if (cause instanceof EngineError) throw cause;
      const message = cause instanceof Error ? cause.message : String(cause);
      const lower = message.toLowerCase();
      if (lower.includes('abort') || lower.includes('timeout')) {
        throw new EngineError('timeout', PROVIDER, message, { cause });
      }
      throw new EngineError('provider_error', PROVIDER, message, { cause });
    } finally {
      clearTimeout(timer);
    }
  }
}

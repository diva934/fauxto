import 'server-only';
import { GoogleGenAI, Type } from '@google/genai';
import { z } from 'zod';
import { serverEnv } from '@/lib/env';
import { EngineError, type ModerationEngine, type VisionAnalysis } from './types';

const PROVIDER = 'google';

/**
 * Modèle de vision pour l'analyse de l'image source.
 *
 * ⚠️ Identifiant à VÉRIFIER contre l'API avant mise en production — il est
 * surchargeable par `GEMINI_MODERATION_MODEL` précisément pour qu'une
 * correction ne demande pas de redéploiement de code.
 */
const DEFAULT_MODERATION_MODEL =
  process.env.GEMINI_MODERATION_MODEL?.trim() || 'gemini-3.1-flash';

/** La modération doit être rapide : elle s'ajoute au temps d'attente perçu. */
const MODERATION_TIMEOUT_MS = 10_000;

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

export class GeminiModerationEngine implements ModerationEngine {
  readonly provider = PROVIDER;

  async analyze(input: { image: Buffer; mimeType: string }): Promise<VisionAnalysis> {
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
                  data: input.image.toString('base64'),
                  mimeType: input.mimeType,
                },
              },
              { text: ANALYSIS_PROMPT },
            ],
          },
        ],
        config: {
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
          temperature: 0,
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

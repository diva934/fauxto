import { after, type NextRequest } from 'next/server';
import { computeFingerprint } from '@/lib/anon-session';
import {
  confirmUsage,
  refundUsage,
  resolveEntitlement,
  type Entitlement,
} from '@/lib/credits';
import { getImageEngine, resolveModelId } from '@/lib/image-engine';
import { EngineError } from '@/lib/image-engine/types';
import { moderateSourceImage } from '@/lib/moderation';
import { finalizeImage } from '@/lib/postprocess';
import { checkRateLimit } from '@/lib/rate-limit';
import { currentUser } from '@/lib/supabase/server';
import { optionalServiceClient } from '@/lib/supabase/service';
import { GENERATIONS_BUCKET } from '@/lib/supabase/types';
import { getTemplateById } from '@/lib/templates';
import { BRAND } from '@/lib/utils';
import {
  encodeEvent,
  STAGE_PROGRESS,
  type GenerateErrorCode,
  type GenerateEvent,
  type GenerationStage,
} from '@/lib/generate-protocol';

// sharp et c2pa-node sont des modules natifs : runtime Node obligatoire.
export const runtime = 'nodejs';
// Le pipeline complet (modération + génération + marquage) tient sous 25 s, mais
// on se laisse de la marge pour ne pas être coupé par la plateforme.
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const ACCEPTED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

interface ParsedRequest {
  photo: Buffer;
  mimeType: string;
  templateId: string;
  overlayInputs: Record<number, string>;
}

type ParseResult =
  | { ok: true; value: ParsedRequest }
  | { ok: false; code: GenerateErrorCode; messageFr: string };

async function parseRequest(request: NextRequest): Promise<ParseResult> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return { ok: false, code: 'invalid_input', messageFr: 'Requête illisible.' };
  }

  // Le consentement est vérifié côté serveur, pas seulement côté interface :
  // une case cochée dans le navigateur ne prouve rien.
  if (form.get('consent') !== 'true') {
    return {
      ok: false,
      code: 'invalid_input',
      messageFr: 'Tu dois confirmer que tu as le droit d’utiliser cette photo.',
    };
  }

  const templateId = String(form.get('templateId') ?? '');
  if (!getTemplateById(templateId)) {
    return { ok: false, code: 'invalid_input', messageFr: 'Ce prank n’existe pas.' };
  }

  const file = form.get('photo');
  if (!(file instanceof File)) {
    return { ok: false, code: 'invalid_input', messageFr: 'Aucune photo reçue.' };
  }
  if (file.size === 0) {
    return { ok: false, code: 'invalid_input', messageFr: 'La photo est vide.' };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      code: 'invalid_input',
      messageFr: 'Photo trop lourde. Réessaie, elle sera compressée automatiquement.',
    };
  }
  if (!ACCEPTED_MIME.has(file.type)) {
    return {
      ok: false,
      code: 'invalid_input',
      messageFr: 'Format non géré. Utilise une photo JPEG, PNG ou WebP.',
    };
  }

  const overlayInputs: Record<number, string> = {};
  for (const [key, value] of form.entries()) {
    const match = /^overlay\[(\d+)\]$/.exec(key);
    if (match && typeof value === 'string') {
      // 40 caractères : au-delà, le texte devient illisible sur l'image.
      overlayInputs[Number(match[1])] = value.slice(0, 40);
    }
  }

  return {
    ok: true,
    value: {
      photo: Buffer.from(await file.arrayBuffer()),
      mimeType: file.type,
      templateId,
      overlayInputs,
    },
  };
}

/** Crée la ligne de suivi. Renvoie `null` si la base n'est pas configurée. */
async function createGenerationRow(input: {
  entitlement: Entitlement;
  templateId: string;
}): Promise<string | null> {
  const supabase = optionalServiceClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('generations')
    .insert({
      template_id: input.templateId,
      status: 'pending',
      user_id: input.entitlement.kind === 'credit' ? input.entitlement.userId : null,
      anon_session_id:
        input.entitlement.kind === 'free' ? input.entitlement.anonSessionId : null,
      watermarked: input.entitlement.watermarked,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[generate] Création de la ligne impossible :', error.message);
    return null;
  }
  return data.id;
}

export async function POST(request: NextRequest): Promise<Response> {
  const parsed = await parseRequest(request);
  if (!parsed.ok) {
    return jsonError(parsed.code, parsed.messageFr, 400);
  }

  const template = getTemplateById(parsed.value.templateId);
  if (!template) {
    return jsonError('invalid_input', 'Ce prank n’existe pas.', 400);
  }

  // ── Limitation de débit, avant tout travail coûteux ──────────────────────
  let rateKey: string;
  try {
    rateKey = computeFingerprint(request.headers);
  } catch {
    // FINGERPRINT_SALT absente : on ne peut pas identifier le visiteur, donc on
    // ne peut ni limiter ni compter la gratuité. Refus explicite plutôt que
    // dégradation silencieuse.
    return jsonError(
      'server_error',
      'Service mal configuré. Réessaie plus tard.',
      500,
    );
  }

  const rate = await checkRateLimit(rateKey);
  if (!rate.success) {
    return jsonError(
      'rate_limited',
      'Tu as fait beaucoup d’essais d’un coup. Attends quelques minutes.',
      429,
    );
  }

  // ── Droit à générer ──────────────────────────────────────────────────────
  const user = await currentUser();
  const entitlementResult = await resolveEntitlement({
    headers: request.headers,
    userId: user?.id ?? null,
  });

  if (!entitlementResult.granted) {
    const code: GenerateErrorCode =
      entitlementResult.reason === 'no_credits' ? 'no_credits' : 'no_credits';
    return jsonError(
      code,
      entitlementResult.reason === 'free_already_used'
        ? 'Ta première photo était offerte. Prends un pack pour continuer.'
        : 'Tu n’as plus de crédits.',
      402,
    );
  }

  const entitlement = entitlementResult.entitlement;
  const generationId = await createGenerationRow({
    entitlement,
    templateId: template.id,
  });

  // ── Flux d'étapes ────────────────────────────────────────────────────────
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      let closed = false;

      const send = (event: GenerateEvent): void => {
        if (closed) return;
        controller.enqueue(encoder.encode(encodeEvent(event)));
      };
      const stage = (name: GenerationStage): void =>
        send({ type: 'stage', stage: name, progress: STAGE_PROGRESS[name] });

      const fail = async (
        code: GenerateErrorCode,
        messageFr: string,
        detail?: string,
        moderationFlag?: string,
      ): Promise<void> => {
        await refundUsage(entitlement, generationId);
        await markFailed(generationId, detail ?? messageFr, moderationFlag);
        send({ type: 'error', code, messageFr, refunded: true });
      };

      try {
        stage('reception');

        // ── Modération : avant l'appel coûteux, et fail-closed ────────────
        stage('moderation');
        const decision = await moderateSourceImage({
          image: parsed.value.photo,
          mimeType: parsed.value.mimeType,
        });

        if (!decision.allowed) {
          await fail(
            'moderation_refused',
            decision.messageFr,
            `modération: ${decision.flag}`,
            decision.flag,
          );
          return;
        }

        // ── Génération ────────────────────────────────────────────────────
        stage('generation');
        const edited = await getImageEngine().edit({
          sourceImage: parsed.value.photo,
          sourceMimeType: parsed.value.mimeType,
          prompt: template.prompt,
          aspectRatio: template.aspectRatio,
          modelId: resolveModelId(template.model),
        });

        // ── Marquage triple couche ────────────────────────────────────────
        stage('marquage');
        const finalized = await finalizeImage({
          image: edited.image,
          template,
          aspectRatio: template.aspectRatio,
          modelId: edited.modelId,
          provider: edited.provider,
          watermarked: entitlement.watermarked,
          domain: BRAND.domain,
          overlayInputs: parsed.value.overlayInputs,
        });

        // ── Persistance ───────────────────────────────────────────────────
        const outputPath = await storeImage(generationId, finalized.image);
        await markDone(generationId, {
          provider: edited.provider,
          modelId: edited.modelId,
          outputPath,
          c2paApplied: finalized.marking.c2paApplied,
          c2paSigner: finalized.marking.c2paSigner,
        });
        await confirmUsage(entitlement, generationId ?? '');

        send({
          type: 'done',
          image: finalized.image.toString('base64'),
          mimeType: finalized.mimeType,
          width: finalized.width,
          height: finalized.height,
          generationId: generationId ?? 'local',
          watermarked: entitlement.watermarked,
          creditsLeft: entitlement.kind === 'credit' ? entitlement.creditsLeft : null,
          freeUsed: entitlement.kind === 'free',
        });
      } catch (cause) {
        if (cause instanceof EngineError) {
          const code: GenerateErrorCode =
            cause.code === 'timeout'
              ? 'timeout'
              : cause.code === 'rate_limited'
                ? 'rate_limited'
                : 'engine_failed';
          await fail(code, cause.userMessageFr, `${cause.code}: ${cause.message}`);
        } else {
          const detail = cause instanceof Error ? cause.message : String(cause);
          console.error('[generate] Échec inattendu :', detail);
          await fail(
            'server_error',
            'Un problème est survenu. Ton crédit n’a pas été débité.',
            detail,
          );
        }
      } finally {
        closed = true;
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      // Empêche la mise en tampon par un proxy, qui annulerait le streaming.
      'X-Accel-Buffering': 'no',
      Connection: 'keep-alive',
    },
  });
}

function jsonError(
  code: GenerateErrorCode,
  messageFr: string,
  status: number,
): Response {
  const event: GenerateEvent = { type: 'error', code, messageFr, refunded: false };
  return new Response(encodeEvent(event), {
    status,
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

/** Dépose l'image dans le bucket privé. Renvoie `null` sans base configurée. */
async function storeImage(
  generationId: string | null,
  image: Buffer,
): Promise<string | null> {
  const supabase = optionalServiceClient();
  if (!supabase || !generationId) return null;

  const path = `${generationId}.jpg`;
  const { error } = await supabase.storage
    .from(GENERATIONS_BUCKET)
    .upload(path, image, { contentType: 'image/jpeg', upsert: true });

  if (error) {
    // L'image a été générée et va être renvoyée au client : on ne fait pas
    // échouer la requête pour un problème de stockage.
    console.error('[generate] Dépôt Storage impossible :', error.message);
    return null;
  }
  return path;
}

async function markDone(
  generationId: string | null,
  fields: {
    provider: string;
    modelId: string;
    outputPath: string | null;
    c2paApplied: boolean;
    c2paSigner: string;
  },
): Promise<void> {
  const supabase = optionalServiceClient();
  if (!supabase || !generationId) return;

  // `after` : la réponse part sans attendre l'écriture, mais l'écriture a bien
  // lieu — c'est du confort de latence, pas du best-effort.
  after(async () => {
    const { error } = await supabase
      .from('generations')
      .update({
        status: 'done',
        provider: fields.provider,
        model_id: fields.modelId,
        output_path: fields.outputPath,
        c2pa_applied: fields.c2paApplied,
        c2pa_signer: fields.c2paSigner,
      })
      .eq('id', generationId);
    if (error) console.error('[generate] markDone a échoué :', error.message);
  });
}

async function markFailed(
  generationId: string | null,
  errorMessage: string,
  moderationFlag?: string,
): Promise<void> {
  const supabase = optionalServiceClient();
  if (!supabase || !generationId) return;

  const { error } = await supabase
    .from('generations')
    .update({
      status: 'failed',
      error_message: errorMessage.slice(0, 500),
      moderation_flag: moderationFlag ?? null,
    })
    .eq('id', generationId);
  if (error) console.error('[generate] markFailed a échoué :', error.message);
}

'use client';

import imageCompression from 'browser-image-compression';
import { AlertTriangle, Camera, ImageUp, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  CLIENT_TIMEOUT_MS,
  createEventParser,
  STAGE_PROGRESS,
  type GenerateErrorCode,
  type GenerationStage,
} from '@/lib/generate-protocol';
import type { PrankTemplate } from '@/lib/templates';
import { ConsentCheckbox } from './ConsentCheckbox';
import { ProgressScreen } from './ProgressScreen';
import { ResultScreen } from './ResultScreen';

/**
 * Parcours complet upload → génération → résultat, en un seul composant client.
 *
 * Pas de navigation entre les étapes : l'utilisateur reste sur la même page, ce
 * qui supprime les chargements intermédiaires et donne la sensation d'une app.
 */

type Phase = 'upload' | 'generating' | 'done' | 'error';

interface ErrorState {
  code: GenerateErrorCode;
  messageFr: string;
  refunded: boolean;
}

/** Compression avant upload — §3.3. Réduit le coût et le temps d'attente. */
const COMPRESSION_OPTIONS = {
  maxWidthOrHeight: 1600,
  initialQuality: 0.85,
  useWebWorker: true,
  fileType: 'image/jpeg',
} as const;

export function PrankFlow({ template }: { template: PrankTemplate }) {
  const [phase, setPhase] = useState<Phase>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [consent, setConsent] = useState(false);
  const [overlayInputs, setOverlayInputs] = useState<Record<number, string>>({});

  const [stage, setStage] = useState<GenerationStage | null>(null);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{
    blob: Blob;
    watermarked: boolean;
    creditsLeft: number | null;
  } | null>(null);
  const [error, setError] = useState<ErrorState | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  /** Champs personnalisables (chèque, magazine). Dérivés du template, côté client. */
  const editableSlots = useMemo(
    () =>
      (template.textOverlays ?? [])
        .map((slot, index) => ({ slot, index }))
        .filter(({ slot }) => Boolean(slot.userInputLabelFr)),
    [template.textOverlays],
  );

  const handleFileSelected = useCallback(async (selected: File): Promise<void> => {
    setError(null);
    setCompressing(true);
    try {
      const compressed = await imageCompression(selected, COMPRESSION_OPTIONS);
      // `imageCompression` renvoie un Blob : on le renomme en File pour que le
      // `Content-Type` de la partie multipart soit correct côté serveur.
      const named = new File([compressed], 'photo.jpg', { type: 'image/jpeg' });
      setFile(named);
      setPreviewUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return URL.createObjectURL(named);
      });
    } catch {
      setError({
        code: 'invalid_input',
        messageFr: "Cette image n'a pas pu être lue. Essaie avec une autre photo.",
        refunded: false,
      });
    } finally {
      setCompressing(false);
    }
  }, []);

  const generate = useCallback(async (): Promise<void> => {
    if (!file || !consent) return;

    setPhase('generating');
    setStage(null);
    setProgress(0);
    setError(null);

    const controller = new AbortController();
    // Au-delà de 25 s, on abandonne côté client et on affiche un échec (§3.4).
    const timeout = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);

    try {
      const form = new FormData();
      form.append('photo', file);
      form.append('templateId', template.id);
      form.append('consent', 'true');
      for (const [index, value] of Object.entries(overlayInputs)) {
        if (value.trim()) form.append(`overlay[${index}]`, value);
      }

      const response = await fetch('/api/generate', {
        method: 'POST',
        body: form,
        signal: controller.signal,
      });

      if (!response.body) {
        throw new Error('Réponse sans corps');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const parseChunk = createEventParser();
      let settled = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        for (const event of parseChunk(decoder.decode(value, { stream: true }))) {
          if (event.type === 'stage') {
            setStage(event.stage);
            setProgress(event.progress);
          } else if (event.type === 'done') {
            const bytes = Uint8Array.from(atob(event.image), (char) =>
              char.charCodeAt(0),
            );
            setResult({
              blob: new Blob([bytes], { type: event.mimeType }),
              watermarked: event.watermarked,
              creditsLeft: event.creditsLeft,
            });
            setProgress(100);
            setPhase('done');
            settled = true;
          } else if (event.type === 'error') {
            setError({
              code: event.code,
              messageFr: event.messageFr,
              refunded: event.refunded,
            });
            setPhase('error');
            settled = true;
          }
        }
      }

      // Le flux s'est terminé sans verdict : coupure réseau en cours de route.
      if (!settled) {
        setError({
          code: 'server_error',
          messageFr:
            'La connexion a été interrompue. Rien ne t’a été débité, réessaie.',
          refunded: true,
        });
        setPhase('error');
      }
    } catch (cause) {
      const aborted = cause instanceof DOMException && cause.name === 'AbortError';
      setError({
        code: aborted ? 'timeout' : 'server_error',
        messageFr: aborted
          ? "Ça a pris trop de temps. Ton crédit n'a pas été débité — réessaie."
          : 'Connexion perdue. Réessaie dans un instant.',
        refunded: true,
      });
      setPhase('error');
    } finally {
      clearTimeout(timeout);
    }
  }, [file, consent, overlayInputs, template.id]);

  const restart = useCallback((): void => {
    setPhase('upload');
    setResult(null);
    setError(null);
    setStage(null);
    setProgress(0);
    setConsent(false);
    setFile(null);
    setPreviewUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return null;
    });
  }, []);

  // ── Génération en cours ──────────────────────────────────────────────────
  if (phase === 'generating') {
    return (
      <ProgressScreen
        stage={stage}
        progress={progress || STAGE_PROGRESS.reception}
        templateName={template.nameFr}
      />
    );
  }

  // ── Résultat ─────────────────────────────────────────────────────────────
  if (phase === 'done' && result) {
    return (
      <ResultScreen
        blob={result.blob}
        templateName={template.nameFr}
        templateId={template.id}
        watermarked={result.watermarked}
        creditsLeft={result.creditsLeft}
        onRestart={restart}
      />
    );
  }

  // ── Échec ────────────────────────────────────────────────────────────────
  if (phase === 'error' && error) {
    const needsCredits = error.code === 'no_credits';

    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-danger/15">
          <AlertTriangle className="size-7 text-danger" aria-hidden />
        </div>

        <h2 className="mt-4 text-2xl font-extrabold leading-tight tracking-tight">
          {needsCredits ? 'Ta photo offerte est déjà passée' : 'Ça n’a pas marché'}
        </h2>
        <p className="mt-2 max-w-sm text-base leading-snug text-muted" role="alert">
          {error.messageFr}
        </p>

        {error.refunded && !needsCredits ? (
          <p className="mt-2 text-sm text-success">Aucun crédit débité.</p>
        ) : null}

        <div className="mt-6 w-full max-w-sm space-y-2">
          {needsCredits ? (
            <Button asChild block size="lg">
              <Link href="/credits">Voir les packs</Link>
            </Button>
          ) : (
            <Button block size="lg" onClick={restart}>
              <RotateCcw className="size-5" aria-hidden />
              Réessayer
            </Button>
          )}
          <Button asChild variant="ghost" block size="md">
            <Link href="/creer">Choisir un autre prank</Link>
          </Button>
        </div>
      </div>
    );
  }

  // ── Upload ───────────────────────────────────────────────────────────────
  const canGenerate = Boolean(file) && consent && !compressing;

  return (
    <div className="flex flex-1 flex-col px-5 pb-4">
      <div className="flex-1">
        {/* Zone de sélection / aperçu */}
        {previewUrl ? (
          <div className="relative mx-auto w-full max-w-sm overflow-hidden rounded-card bg-surface">
            {/* eslint-disable-next-line @next/next/no-img-element -- aperçu depuis un object URL local */}
            <img
              src={previewUrl}
              alt="Aperçu de la photo choisie"
              className="aspect-4/5 w-full object-cover"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-3 right-3 min-h-touch rounded-pill bg-ink/80 px-4 text-sm font-semibold backdrop-blur"
            >
              Changer
            </button>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-sm space-y-3">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              disabled={compressing}
              className="flex aspect-4/5 w-full flex-col items-center justify-center gap-3 rounded-card border-2 border-dashed border-line bg-surface text-muted transition-colors hover:border-accent/50 hover:text-text disabled:opacity-50"
            >
              <Camera className="size-10" aria-hidden />
              <span className="text-lg font-semibold">Prendre une photo</span>
              <span className="text-sm">ou choisir dans la galerie ↓</span>
            </button>

            <Button
              variant="secondary"
              block
              size="lg"
              disabled={compressing}
              onClick={() => fileInputRef.current?.click()}
            >
              <ImageUp className="size-5" aria-hidden />
              Choisir une photo
            </Button>
          </div>
        )}

        {/* `capture` ouvre l'appareil photo ; l'autre entrée ouvre la galerie. */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(event) => {
            const selected = event.target.files?.[0];
            if (selected) void handleFileSelected(selected);
            event.target.value = '';
          }}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(event) => {
            const selected = event.target.files?.[0];
            if (selected) void handleFileSelected(selected);
            event.target.value = '';
          }}
        />

        {compressing ? (
          <p className="mt-3 text-center text-sm text-muted" role="status">
            Préparation de la photo…
          </p>
        ) : null}

        {/* Personnalisation du texte incrusté (chèque, magazine) */}
        {file && editableSlots.length > 0 ? (
          <div className="mx-auto mt-4 w-full max-w-sm space-y-3">
            {editableSlots.map(({ slot, index }) => (
              <label key={index} className="block">
                <span className="text-sm font-medium text-muted">
                  {slot.userInputLabelFr}
                </span>
                <input
                  type="text"
                  maxLength={40}
                  placeholder={slot.defaultText}
                  value={overlayInputs[index] ?? ''}
                  onChange={(event) =>
                    setOverlayInputs((current) => ({
                      ...current,
                      [index]: event.target.value,
                    }))
                  }
                  className="mt-1 min-h-touch w-full rounded-card border border-line bg-surface px-4 text-base text-text placeholder:text-muted/60 focus:border-accent focus:outline-none"
                />
              </label>
            ))}
            <p className="text-xs text-muted">
              Le texte est ajouté par nos serveurs, pas par l’IA — l’orthographe
              est donc garantie.
            </p>
          </div>
        ) : null}

        {/* Consentement — obligatoire, jamais pré-coché */}
        {file ? (
          <div className="mx-auto mt-4 w-full max-w-sm">
            <ConsentCheckbox checked={consent} onChange={setConsent} />
          </div>
        ) : null}
      </div>

      <div className="mx-auto mt-5 w-full max-w-sm">
        <Button
          block
          size="xl"
          disabled={!canGenerate}
          onClick={() => void generate()}
          className="text-xl"
        >
          {template.emoji} Générer
        </Button>
        {file && !consent ? (
          <p className="mt-2 text-center text-xs text-muted">
            Coche la case pour continuer
          </p>
        ) : null}
      </div>
    </div>
  );
}

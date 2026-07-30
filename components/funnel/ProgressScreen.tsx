'use client';

import { useEffect, useState } from 'react';
import { STAGE_MESSAGES_FR, type GenerationStage } from '@/lib/generate-protocol';

/**
 * Écran d'attente — §3.4.
 *
 * La barre reflète des JALONS RÉELS reçus du serveur (`stage` events), pas une
 * interpolation temporelle. Entre deux jalons, on laisse la barre progresser
 * très lentement vers le jalon suivant sans jamais l'atteindre : ça évite
 * l'impression de blocage sur une longue étape, sans mentir sur l'avancement.
 */

const ROTATING_MESSAGES = [
  'On prépare le terrain…',
  'Il ne va rien comprendre…',
  'Encore deux secondes…',
  'On soigne les détails…',
  'Presque prêt à envoyer…',
] as const;

export function ProgressScreen({
  stage,
  progress,
  templateName,
}: {
  stage: GenerationStage | null;
  progress: number;
  templateName: string;
}) {
  const [displayed, setDisplayed] = useState(progress);
  const [rotatingIndex, setRotatingIndex] = useState(0);

  // Avance douce vers le jalon reçu, puis dérive lente au-delà — plafonnée pour
  // ne jamais dépasser le jalon suivant.
  useEffect(() => {
    setDisplayed((current) => Math.max(current, progress));

    const interval = setInterval(() => {
      setDisplayed((current) => {
        const ceiling = Math.min(progress + 12, 97);
        return current < ceiling ? current + 0.4 : current;
      });
    }, 120);

    return () => clearInterval(interval);
  }, [progress]);

  useEffect(() => {
    const interval = setInterval(() => {
      setRotatingIndex((index) => (index + 1) % ROTATING_MESSAGES.length);
    }, 2600);
    return () => clearInterval(interval);
  }, []);

  const stageMessage = stage ? STAGE_MESSAGES_FR[stage] : 'On démarre…';

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-semibold tracking-wide text-accent">
        {templateName.toUpperCase()}
      </p>

      <h2
        className="mt-4 text-3xl font-extrabold leading-tight tracking-tight"
        aria-live="polite"
      >
        {stageMessage}
      </h2>

      <p className="mt-2 h-6 text-base text-muted transition-opacity">
        {ROTATING_MESSAGES[rotatingIndex]}
      </p>

      <div
        className="mt-8 h-3 w-full max-w-xs overflow-hidden rounded-pill bg-surface-2"
        role="progressbar"
        aria-valuenow={Math.round(displayed)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progression de la génération"
      >
        <div
          className="h-full rounded-pill bg-accent transition-[width] duration-200 ease-out"
          style={{ width: `${Math.min(displayed, 100)}%` }}
        />
      </div>

      <p className="mt-3 text-sm tabular-nums text-muted">
        {Math.round(Math.min(displayed, 100))}&nbsp;%
      </p>
    </div>
  );
}

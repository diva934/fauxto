'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';
import { Button } from '@/components/ui/button';
import { ShareButtons } from './ShareButtons';

/**
 * Écran de résultat — §3.5, l'écran le plus important du produit.
 *
 * L'ordre est celui du cahier des charges, et il n'est pas cosmétique :
 *   1. l'image ;
 *   2. les trois boutons de partage ;
 *   3. « Refaire un prank » ;
 *   4. l'invitation à installer l'app — ICI et nulle part ailleurs, parce que
 *      c'est le seul instant où l'utilisateur vient de vivre le moment de
 *      satisfaction et acceptera.
 *
 * Aucune mention n'est incrustée dans les pixels : elle lèverait le doute du
 * destinataire, donc l'objet du produit. Le marquage de provenance, lui, reste
 * apposé — il est invisible à l'œil et lisible à l'analyse.
 *
 * Conséquence assumée : c'est à l'utilisateur de dire que l'image est générée
 * quand il la partage. L'écran le rappelle, à l'instant précis où il s'apprête
 * à le faire — le seul moment où l'avertissement a une chance d'être lu.
 */
export function ResultScreen({
  blob,
  templateName,
  templateId,
  watermarked,
  creditsLeft,
  onRestart,
}: {
  blob: Blob;
  templateName: string;
  templateId: string;
  watermarked: boolean;
  creditsLeft: number;
  onRestart: () => void;
}) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(blob);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [blob]);

  const filename = `fauxto-${templateId}.jpg`;

  return (
    <div className="flex flex-1 flex-col px-5 pb-4">
      {/* 1. L'image, en 4:5 — le format qui performe le mieux en repartage. */}
      <div className="relative mx-auto w-full max-w-sm overflow-hidden rounded-card bg-surface">
        {objectUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- blob local : next/image n'apporte rien et ne sait pas optimiser un object URL
          <img
            src={objectUrl}
            alt={`Résultat du prank ${templateName}, image générée par intelligence artificielle.`}
            className="aspect-4/5 w-full object-cover"
          />
        ) : (
          <div className="aspect-4/5 w-full animate-pulse bg-surface-2" />
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Dis à la personne que l’image est générée par IA quand tu la partages.
        C’est à toi de le faire : rien ne l’indique sur l’image.
      </p>

      {/* 2. Partage — un seul tap. */}
      <div className="mt-4">
        <ShareButtons blob={blob} filename={filename} />
      </div>

      {/* 3. Recommencer. */}
      <div className="mt-3 flex gap-2">
        <Button variant="outline" block size="md" onClick={onRestart}>
          Refaire un prank
        </Button>
      </div>

      <p className="mt-2 text-center text-sm text-muted">
        {creditsLeft > 0 ? (
          <>
            Il te reste{' '}
            <span className="font-semibold text-text">
              {creditsLeft} {creditsLeft > 1 ? 'pranks' : 'prank'}
            </span>
          </>
        ) : (
          <Link href="/credits" className="underline hover:text-text">
            Plus de crédits — en reprendre
          </Link>
        )}
      </p>

      {/* Relance vers les lots : c'est le moment où l'utilisateur vient de voir
          le résultat, donc le seul où l'argument du prix unitaire porte. */}
      {creditsLeft === 0 ? (
        <Link
          href="/credits"
          className="mt-3 block rounded-card border border-line bg-surface p-3 text-center text-sm text-muted hover:border-accent/40"
        >
          15 pranks pour 8,99 € —{' '}
          <span className="font-semibold text-accent-strong">0,60 € l’unité</span>
        </Link>
      ) : null}

      {/* 4. Installation — uniquement ici, après le succès. */}
      <InstallPrompt />
    </div>
  );
}

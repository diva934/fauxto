'use client';

import { Download, MessageCircle, Share2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { BRAND } from '@/lib/utils';

/**
 * Partage du résultat — §3.5.
 *
 * Ce qui est réellement possible sur le web, et ce qu'on en fait :
 *
 * · L'API Web Share niveau 2 (`navigator.share({ files })`) ouvre la feuille de
 *   partage native avec le FICHIER. C'est le seul chemin qui envoie vraiment
 *   l'image vers WhatsApp ou Snapchat en un tap. Disponible sur iOS Safari et
 *   Chrome Android. C'est donc le chemin principal.
 *
 * · `wa.me` ne transporte que du texte : impossible d'y joindre une image. On ne
 *   s'en sert qu'en repli, avec un message et le lien du site.
 *
 * · Snapchat n'expose aucune intention web pour envoyer un fichier. En repli, on
 *   télécharge l'image et on le dit clairement, plutôt que d'ouvrir une page qui
 *   ne ferait rien.
 *
 * Les trois boutons demandés sont bien là ; chacun fait la chose la plus
 * efficace réellement disponible, sans promettre ce que le navigateur ne sait
 * pas faire.
 */

const SHARE_TEXT = `Regarde ce que j'ai fait avec ta photo 😂 ${BRAND.domain}`;

function canShareFiles(file: File): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] })
  );
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Laisse le temps au navigateur d'entamer le téléchargement.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function ShareButtons({
  blob,
  filename,
  onShared,
}: {
  blob: Blob;
  filename: string;
  onShared?: () => void;
}) {
  const [notice, setNotice] = useState<string | null>(null);

  const file = new File([blob], filename, { type: blob.type });
  const supportsFileShare = canShareFiles(file);

  const shareNative = async (fallback: () => void): Promise<void> => {
    if (!supportsFileShare) {
      fallback();
      return;
    }
    try {
      await navigator.share({ files: [file], text: SHARE_TEXT });
      onShared?.();
    } catch (cause) {
      // L'utilisateur a annulé : ce n'est pas une erreur, on ne dit rien.
      if (cause instanceof DOMException && cause.name === 'AbortError') return;
      fallback();
    }
  };

  const handleWhatsApp = (): void => {
    void shareNative(() => {
      // Repli : WhatsApp ne prend que du texte via wa.me. On télécharge l'image
      // et on ouvre la conversation avec le message.
      downloadBlob(blob, filename);
      window.open(
        `https://wa.me/?text=${encodeURIComponent(SHARE_TEXT)}`,
        '_blank',
        'noopener,noreferrer',
      );
      setNotice('Image téléchargée — joins-la depuis WhatsApp.');
    });
  };

  const handleSnapchat = (): void => {
    void shareNative(() => {
      downloadBlob(blob, filename);
      setNotice('Image téléchargée — envoie-la depuis Snapchat.');
    });
  };

  const handleDownload = (): void => {
    downloadBlob(blob, filename);
    onShared?.();
    setNotice('Image enregistrée.');
  };

  return (
    <div className="w-full">
      <div className="grid grid-cols-3 gap-2">
        <Button
          variant="primary"
          size="md"
          onClick={handleWhatsApp}
          className="flex-col gap-1 px-2 py-3 text-xs h-auto min-h-touch"
        >
          <MessageCircle className="size-5" aria-hidden />
          WhatsApp
        </Button>

        <Button
          variant="secondary"
          size="md"
          onClick={handleSnapchat}
          className="flex-col gap-1 px-2 py-3 text-xs h-auto min-h-touch"
        >
          <Share2 className="size-5" aria-hidden />
          Snapchat
        </Button>

        <Button
          variant="secondary"
          size="md"
          onClick={handleDownload}
          className="flex-col gap-1 px-2 py-3 text-xs h-auto min-h-touch"
        >
          <Download className="size-5" aria-hidden />
          Télécharger
        </Button>
      </div>

      {notice ? (
        <p className="mt-2 text-center text-xs text-muted" role="status">
          {notice}
        </p>
      ) : null}
    </div>
  );
}

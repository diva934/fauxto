'use client';

import { Copy, Plus, Share, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { BRAND } from '@/lib/utils';

/**
 * Invitation à installer l'app — §6.3.
 *
 * Règles de déclenchement, appliquées à la lettre :
 *   · uniquement APRÈS une génération réussie, sur l'écran de résultat ;
 *   · jamais au chargement de la page ;
 *   · fermeture = pas de nouvelle proposition avant 7 jours ;
 *   · rien du tout si l'app est déjà installée ;
 *   · dans un navigateur intégré (TikTok, Instagram), l'installation est
 *     impossible : on propose d'ouvrir le lien dans Safari, avec un bouton de
 *     copie.
 *
 * Le composant ne s'affiche jamais de lui-même : c'est le parent qui décide du
 * moment, ce qui rend la règle « seulement après succès » structurelle et pas
 * seulement documentaire.
 */

const DISMISSED_KEY = 'fx_install_dismissed_at';
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type Platform = 'android' | 'ios' | 'in-app' | 'unsupported';

function detectPlatform(): Platform {
  const ua = navigator.userAgent;

  if (/TikTok|musical_ly|Instagram|FBAN|FBAV|FB_IAB|Snapchat|Line\/|Twitter/i.test(ua)) {
    return 'in-app';
  }
  // iPadOS 13+ se présente comme un Mac : on le rattrape par le tactile.
  const isIos =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIos) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'unsupported';
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function recentlyDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    if (!raw) return false;
    return Date.now() - Number(raw) < COOLDOWN_MS;
  } catch {
    // Stockage inaccessible (navigation privée stricte) : on ne harcèle pas.
    return true;
  }
}

export function InstallPrompt({ onClose }: { onClose?: () => void }) {
  const [visible, setVisible] = useState(false);
  const [platform, setPlatform] = useState<Platform>('unsupported');
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [copied, setCopied] = useState(false);

  // Capture `beforeinstallprompt` dès le montage : l'événement ne se rejoue pas,
  // donc il faut l'attraper quand il passe, même si on n'affiche rien encore.
  useEffect(() => {
    const handler = (event: Event): void => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return;
    setPlatform(detectPlatform());
    setVisible(true);
  }, []);

  const dismiss = (): void => {
    try {
      localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    } catch {
      // Sans stockage, on ne peut pas mémoriser le refus. Acceptable.
    }
    setVisible(false);
    onClose?.();
  };

  const installAndroid = async (): Promise<void> => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === 'accepted') setVisible(false);
    else dismiss();
  };

  const copyLink = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(`https://${BRAND.domain}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  if (!visible) return null;
  // Sur Android sans événement capturé, l'installation n'est pas proposable :
  // mieux vaut ne rien afficher qu'un bouton qui ne ferait rien.
  if (platform === 'android' && !deferred) return null;
  if (platform === 'unsupported') return null;

  return (
    <div
      className="animate-slide-up mt-4 rounded-card border border-accent/30 bg-surface p-4"
      role="dialog"
      aria-label="Installer l’application"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-base font-bold leading-snug">
          Ajoute {BRAND.name} à ton écran d’accueil
        </p>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Fermer"
          className="-m-2 flex size-11 shrink-0 items-center justify-center text-muted hover:text-text"
        >
          <X className="size-5" />
        </button>
      </div>

      {platform === 'android' ? (
        <>
          <p className="mt-1 text-sm text-muted">
            Un tap, et tu l’ouvres comme une vraie app, sans passer par le
            navigateur.
          </p>
          <Button block size="md" className="mt-3" onClick={() => void installAndroid()}>
            Installer l’app
          </Button>
        </>
      ) : null}

      {platform === 'ios' ? (
        <>
          <p className="mt-1 text-sm text-muted">
            Trois étapes, dix secondes :
          </p>
          <ol className="mt-3 space-y-3">
            <li className="flex items-center gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-ink">
                1
              </span>
              <span className="flex flex-1 items-center gap-2 text-sm">
                Appuie sur
                {/* Reproduction de l'icône Partager d'iOS : l'utilisateur doit
                    reconnaître le bouton du premier coup d'œil. */}
                <span className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-1 font-medium">
                  <Share className="size-4 text-[#0A84FF]" aria-hidden />
                  Partager
                </span>
                en bas
              </span>
            </li>
            <li className="flex items-center gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-ink">
                2
              </span>
              <span className="flex flex-1 items-center gap-2 text-sm">
                Choisis
                <span className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-1 font-medium">
                  <Plus className="size-4" aria-hidden />
                  Sur l’écran d’accueil
                </span>
              </span>
            </li>
            <li className="flex items-center gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-ink">
                3
              </span>
              <span className="flex-1 text-sm">
                Appuie sur <strong>Ajouter</strong>
              </span>
            </li>
          </ol>
        </>
      ) : null}

      {platform === 'in-app' ? (
        <>
          <p className="mt-1 text-sm text-muted">
            Tu es dans le navigateur de l’application. L’installation n’y est pas
            possible — ouvre ce lien dans Safari ou Chrome.
          </p>
          <Button
            block
            size="md"
            variant="secondary"
            className="mt-3"
            onClick={() => void copyLink()}
          >
            <Copy className="size-4" aria-hidden />
            {copied ? 'Lien copié !' : `Copier ${BRAND.domain}`}
          </Button>
        </>
      ) : null}
    </div>
  );
}

'use client';

import { Check, Copy, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

/**
 * Bouton d'adhésion au programme partenaire, et copie du lien une fois obtenu.
 *
 * Client parce qu'il faut un état local (chargement, copie confirmée) et
 * l'accès au presse-papiers. Le code lui-même est attribué côté serveur : ce
 * composant ne fait que le demander et l'afficher.
 */
export function JoinPartner({ siteUrl }: { siteUrl: string }) {
  const [state, setState] = useState<'idle' | 'joining'>('idle');
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const link = code ? `${siteUrl}/r/${code}` : null;

  async function join() {
    setState('joining');
    setError(null);
    try {
      const response = await fetch('/api/partner/join', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      const payload = (await response.json()) as { code?: string; error?: string };

      if (!response.ok || !payload.code) {
        setError(payload.error ?? 'Impossible pour le moment. Réessaie.');
        setState('idle');
        return;
      }
      setCode(payload.code);
      setState('idle');
    } catch {
      setError('Connexion interrompue. Réessaie.');
      setState('idle');
    }
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Presse-papiers refusé : le lien reste sélectionnable à la main.
      setError('Copie refusée par le navigateur. Sélectionne le lien à la main.');
    }
  }

  if (link) {
    return (
      <div className="rounded-card border border-line bg-surface p-4">
        <p className="text-xs text-muted">Ton lien</p>
        <p className="mt-1 font-mono text-sm break-all">{link}</p>
        <Button type="button" onClick={copy} className="mt-3 w-full" variant="secondary">
          {copied ? (
            <>
              <Check className="size-4" aria-hidden /> Copié
            </>
          ) : (
            <>
              <Copy className="size-4" aria-hidden /> Copier le lien
            </>
          )}
        </Button>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          Recharge la page pour voir tes statistiques. Elles se mettent à jour à
          chaque clic et à chaque vente.
        </p>
      </div>
    );
  }

  return (
    <div>
      <Button type="button" onClick={join} disabled={state === 'joining'} className="w-full">
        {state === 'joining' ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden /> Création…
          </>
        ) : (
          'Obtenir mon lien partenaire'
        )}
      </Button>
      {error ? <p className="mt-2 text-center text-xs text-danger">{error}</p> : null}
    </div>
  );
}

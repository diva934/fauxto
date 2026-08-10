'use client';

import { Check, Loader2 } from 'lucide-react';
import { useState } from 'react';

/**
 * Saisie du code d'un créateur, entendu dans une vidéo.
 *
 * Replié par défaut, derrière un lien discret. Un champ ouvert en permanence
 * sur une page de paiement se lit comme un champ « code promo » : il suggère
 * qu'une réduction existe, et fait hésiter — voire abandonner — celui qui n'en
 * a pas. Replié, il n'est visible que par qui le cherche.
 */
export function ReferralCodeField() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const cleaned = code.trim().toLowerCase();
    if (!cleaned) return;

    setState('sending');
    setError(null);
    try {
      const response = await fetch('/api/partner/attribution', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: cleaned }),
      });
      const payload = (await response.json()) as { code?: string; error?: string };

      if (!response.ok) {
        setError(payload.error ?? 'Ce code n’existe pas.');
        setState('idle');
        return;
      }
      setState('done');
    } catch {
      setError('Connexion interrompue. Réessaie.');
      setState('idle');
    }
  }

  if (state === 'done') {
    return (
      <p className="flex items-center justify-center gap-1.5 text-xs text-muted">
        <Check className="size-3.5 text-accent-strong" aria-hidden />
        Code <span className="font-bold text-text">{code.trim().toLowerCase()}</span> pris
        en compte.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mx-auto block min-h-touch text-xs text-muted underline hover:text-text"
      >
        Tu as un code créateur ?
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-xs">
      <label className="block">
        <span className="text-xs text-muted">
          Entre le code entendu dans la vidéo
        </span>
        <div className="mt-1 flex gap-2">
          <input
            type="text"
            autoFocus
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={24}
            placeholder="ex : lea"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            className="min-h-touch w-full rounded-card border border-line bg-surface px-4 text-base lowercase text-text placeholder:text-muted/60 focus:border-accent focus:outline-none"
          />
          <button
            type="submit"
            disabled={state === 'sending' || !code.trim()}
            className="min-h-touch shrink-0 rounded-card bg-surface-2 px-4 text-sm font-bold text-text disabled:opacity-50"
          >
            {state === 'sending' ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              'Valider'
            )}
          </button>
        </div>
      </label>
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
    </form>
  );
}

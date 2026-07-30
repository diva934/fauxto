'use client';

import { Loader2, Mail } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

/**
 * Connexion par lien e-mail, pour les acheteurs qui reviennent.
 *
 * Aucun mot de passe, et aucune inscription possible depuis ici : le compte se
 * crée uniquement à l'achat (§3.6).
 */
export function SignInForm({ next }: { next?: string }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());

  const submit = async (): Promise<void> => {
    setState('sending');
    setError(null);
    try {
      const response = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), ...(next ? { next } : {}) }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        message?: string;
        error?: string;
      };
      if (!response.ok) {
        setError(payload.error ?? 'L’envoi a échoué.');
        setState('idle');
        return;
      }
      setNotice(payload.message ?? null);
      setState('sent');
    } catch {
      setError('Connexion perdue. Réessaie dans un instant.');
      setState('idle');
    }
  };

  if (state === 'sent') {
    return (
      <div className="rounded-card border border-line bg-surface p-5">
        <Mail className="size-6 text-accent-strong" aria-hidden />
        <p className="mt-3 font-bold">Regarde tes e-mails</p>
        <p className="mt-1 text-[15px] leading-relaxed text-muted">{notice}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="text-sm font-semibold">Ton e-mail</span>
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="toi@exemple.fr"
          className="mt-1.5 min-h-touch w-full rounded-card border border-line bg-surface px-4 text-base text-text placeholder:text-muted/60 focus:border-accent focus:outline-none"
        />
      </label>

      {error ? (
        <p className="rounded-card bg-danger/10 p-3 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <Button
        block
        size="lg"
        disabled={!valid || state === 'sending'}
        onClick={() => void submit()}
      >
        {state === 'sending' ? (
          <>
            <Loader2 className="size-5 animate-spin" aria-hidden />
            Envoi…
          </>
        ) : (
          'Recevoir mon lien de connexion'
        )}
      </Button>

      <p className="text-xs leading-relaxed text-muted">
        Pas de mot de passe à retenir. Si tu n’as pas encore de compte, il se
        crée tout seul avec ce lien.
      </p>
    </div>
  );
}

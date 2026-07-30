'use client';

import { CheckCircle2, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Formulaire de signalement — §7.4.
 *
 * Les deux premiers motifs sont volontairement en tête de liste : ce sont ceux
 * qui déclenchent un traitement prioritaire, et les mettre en avant réduit le
 * risque qu'un signalement grave arrive classé « autre ».
 */

const REASONS = [
  {
    value: 'minor',
    labelFr: 'La photo représente une personne mineure',
    priority: true,
  },
  { value: 'sexual_content', labelFr: 'Contenu à caractère sexuel', priority: true },
  // `priority: false` explicite plutôt qu'absent : avec `as const`, une clé
  // manquante sur certains membres la retire de l'union et casse l'accès.
  {
    value: 'my_image',
    labelFr: 'C’est moi sur l’image, je n’étais pas d’accord',
    priority: false,
  },
  { value: 'harassment', labelFr: 'Harcèlement ou intention de nuire', priority: false },
  { value: 'other', labelFr: 'Autre', priority: false },
] as const;

type Reason = (typeof REASONS)[number]['value'];

export function ReportForm() {
  const [reason, setReason] = useState<Reason | null>(null);
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const canSubmit = reason !== null && message.trim().length >= 10 && state !== 'sending';

  const submit = async (): Promise<void> => {
    setState('sending');
    setError(null);
    try {
      const response = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason,
          message: message.trim(),
          contactEmail: email.trim() || undefined,
        }),
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        setError(payload.error ?? 'L’envoi a échoué. Réessaie dans un instant.');
        setState('error');
        return;
      }
      setState('sent');
    } catch {
      setError('Connexion perdue. Réessaie dans un instant.');
      setState('error');
    }
  };

  if (state === 'sent') {
    return (
      <div className="rounded-card border border-success/40 bg-success/5 p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-success" aria-hidden />
          <div>
            <p className="font-bold text-text">Signalement enregistré</p>
            <p className="mt-1 text-[15px] leading-relaxed text-muted">
              On le traite sous 72&nbsp;heures au plus tard, et en priorité s’il
              concerne une personne mineure ou un contenu sexuel. Si tu as laissé
              un e-mail, tu recevras notre réponse.
            </p>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">
              Rappel utile : les images sont supprimées automatiquement de nos
              serveurs sous 24&nbsp;heures. Celle qui te concerne a donc
              probablement déjà disparu — ça ne nous empêche pas d’agir sur le
              compte à l’origine du signalement.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="text-sm font-semibold text-text">
          Motif du signalement
        </legend>
        <div className="mt-2 space-y-2">
          {REASONS.map((item) => (
            <label
              key={item.value}
              className={cn(
                'flex min-h-touch cursor-pointer items-center gap-3 rounded-card border p-3 text-[15px] transition-colors',
                reason === item.value
                  ? 'border-accent bg-accent/5'
                  : 'border-line bg-surface hover:border-line/70',
              )}
            >
              <input
                type="radio"
                name="reason"
                value={item.value}
                checked={reason === item.value}
                onChange={() => setReason(item.value)}
                className="peer sr-only"
              />
              <span
                aria-hidden
                className={cn(
                  'flex size-5 shrink-0 items-center justify-center rounded-full border-2',
                  reason === item.value ? 'border-accent' : 'border-line',
                )}
              >
                {reason === item.value ? (
                  <span className="size-2.5 rounded-full bg-accent" />
                ) : null}
              </span>
              <span className="flex-1">{item.labelFr}</span>
              {item.priority ? (
                <span className="shrink-0 rounded-md bg-hot/15 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-hot">
                  PRIORITAIRE
                </span>
              ) : null}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className="text-sm font-semibold text-text">
          Décris la situation
          <span className="ml-1 font-normal text-muted">(obligatoire)</span>
        </span>
        <textarea
          rows={5}
          value={message}
          maxLength={2000}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Ce qui s’est passé, où tu as vu l’image, et tout élément qui nous aidera à la retrouver."
          className="mt-1.5 w-full rounded-card border border-line bg-surface p-3 text-[15px] leading-relaxed text-text placeholder:text-muted/60 focus:border-accent focus:outline-none"
        />
        <span className="mt-1 block text-xs text-muted">
          {message.trim().length < 10
            ? 'Au moins dix caractères, pour qu’on puisse agir.'
            : `${message.length}/2000`}
        </span>
      </label>

      <label className="block">
        <span className="text-sm font-semibold text-text">
          Ton e-mail
          <span className="ml-1 font-normal text-muted">(facultatif)</span>
        </span>
        <input
          type="email"
          inputMode="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="pour recevoir notre réponse"
          className="mt-1.5 min-h-touch w-full rounded-card border border-line bg-surface px-4 text-[15px] text-text placeholder:text-muted/60 focus:border-accent focus:outline-none"
        />
      </label>

      {error ? (
        <p className="rounded-card bg-danger/10 p-3 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <Button block size="lg" disabled={!canSubmit} onClick={() => void submit()}>
        {state === 'sending' ? (
          <>
            <Loader2 className="size-5 animate-spin" aria-hidden />
            Envoi…
          </>
        ) : (
          'Envoyer le signalement'
        )}
      </Button>
    </div>
  );
}

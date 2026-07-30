'use client';

import { Check, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { PACKS, pricePerPrank, type CreditPack } from '@/lib/packs';
import { cn, formatPrice } from '@/lib/utils';

/**
 * Écran de crédits — §3.6.
 *
 * L'e-mail est demandé ICI, sur la même vue que le choix du pack : pas d'écran
 * d'inscription, pas de mot de passe, pas de détour. Le compte est créé par le
 * webhook après paiement, et le lien de connexion arrive par e-mail.
 */
export function PackPicker({
  knownEmail,
  next,
}: {
  knownEmail: string | null;
  /** Page vers laquelle revenir après paiement (le prank en cours). */
  next?: string;
}) {
  const [selected, setSelected] = useState<CreditPack>(
    PACKS.find((pack) => pack.highlight) ?? PACKS[0],
  );
  const [email, setEmail] = useState(knownEmail ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsEmail = !knownEmail;
  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
  const canSubmit = !loading && (!needsEmail || emailLooksValid);

  const checkout = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packId: selected.id,
          ...(needsEmail ? { email: email.trim() } : {}),
          ...(next ? { next } : {}),
        }),
      });

      const payload = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !payload.url) {
        setError(payload.error ?? 'Le paiement est indisponible. Réessaie plus tard.');
        setLoading(false);
        return;
      }
      // Redirection vers Stripe : on ne remet pas `loading` à false, la page part.
      window.location.href = payload.url;
    } catch {
      setError('Connexion perdue. Réessaie dans un instant.');
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {PACKS.map((pack) => {
        const isSelected = pack.id === selected.id;
        return (
          <button
            key={pack.id}
            type="button"
            onClick={() => setSelected(pack)}
            aria-pressed={isSelected}
            className={cn(
              'relative flex w-full items-center gap-4 rounded-card border p-4 text-left transition-colors',
              isSelected
                ? 'border-accent bg-accent/5'
                : 'border-line bg-surface hover:border-line/80',
            )}
          >
            <span
              aria-hidden
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-full border-2',
                isSelected ? 'border-accent bg-accent' : 'border-line',
              )}
            >
              {isSelected ? (
                <Check className="size-4 stroke-[3] text-accent-ink" />
              ) : null}
            </span>

            <span className="flex-1">
              <span className="block text-lg font-bold">{pack.labelFr}</span>
              <span className="block text-sm text-muted">
                {formatPrice(pricePerPrank(pack))} par prank
              </span>
            </span>

            <span className="text-right">
              <span className="block text-xl font-extrabold tabular-nums">
                {formatPrice(pack.priceEuros)}
              </span>
            </span>

            {pack.badgeFr ? (
              <span className="absolute -top-2.5 left-12 rounded-pill bg-accent px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-accent-ink">
                {pack.badgeFr}
              </span>
            ) : null}
          </button>
        );
      })}

      {needsEmail ? (
        <label className="block pt-2">
          <span className="text-sm font-medium text-muted">
            Ton e-mail — pour recevoir tes crédits
          </span>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="toi@exemple.fr"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 min-h-touch w-full rounded-card border border-line bg-surface px-4 text-base text-text placeholder:text-muted/60 focus:border-accent focus:outline-none"
          />
          <span className="mt-1 block text-xs text-muted">
            Aucun mot de passe à créer. Tu recevras un lien de connexion.
          </span>
        </label>
      ) : null}

      {error ? (
        <p className="rounded-card bg-danger/10 p-3 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <Button
        block
        size="xl"
        disabled={!canSubmit}
        onClick={() => void checkout()}
        className="mt-2 text-lg"
      >
        {loading ? (
          <>
            <Loader2 className="size-5 animate-spin" aria-hidden />
            Redirection…
          </>
        ) : (
          <>Payer {formatPrice(selected.priceEuros)}</>
        )}
      </Button>

      <p className="pt-1 text-center text-xs text-muted">
        Paiement unique par Stripe. Aucun abonnement, aucun prélèvement récurrent.
      </p>
    </div>
  );
}

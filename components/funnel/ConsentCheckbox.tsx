'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Case de consentement obligatoire — §3.3.
 *
 * Jamais pré-cochée, et le bouton de génération reste désactivé tant qu'elle ne
 * l'est pas. Ce n'est pas une formalité d'interface : c'est la protection
 * juridique de l'utilisateur et du service. Le serveur revérifie de son côté
 * (`consent !== 'true'` rejette la requête), parce qu'une case cochée dans un
 * navigateur ne prouve rien.
 */
export function ConsentCheckbox({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-card border p-4 transition-colors',
        checked ? 'border-accent/60 bg-accent/5' : 'border-line bg-surface',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={cn(
          'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors',
          checked ? 'border-accent bg-accent' : 'border-line bg-transparent',
          'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent',
        )}
      >
        {checked ? <Check className="size-4 stroke-[3] text-accent-ink" /> : null}
      </span>
      <span className="text-sm leading-snug text-text">
        Je confirme que j’ai le droit d’utiliser cette photo et que la personne
        représentée est majeure.
      </span>
    </label>
  );
}

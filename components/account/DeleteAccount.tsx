'use client';

import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

/**
 * Suppression du compte — §7.3 : « accessible en deux clics ».
 *
 * Exactement deux : un premier pour ouvrir la confirmation, un second pour
 * valider. On ne demande pas de retaper son e-mail, on n'envoie pas de lien de
 * confirmation. Un droit RGPD que l'on rend pénible à exercer est un droit que
 * l'on entrave, et c'est sanctionnable.
 *
 * L'étape de confirmation existe uniquement parce que l'action est irréversible
 * et fait perdre les crédits restants — pas pour décourager.
 */
export function DeleteAccount({ credits }: { credits: number }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async (): Promise<void> => {
    setDeleting(true);
    setError(null);
    try {
      const response = await fetch('/api/account/delete', { method: 'POST' });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        setError(payload.error ?? 'La suppression a échoué.');
        setDeleting(false);
        return;
      }
      // Rechargement complet : la session est morte, on repart de l'accueil.
      window.location.href = '/?compte=supprime';
    } catch {
      setError('Connexion perdue. Réessaie dans un instant.');
      setDeleting(false);
    }
  };

  if (!confirming) {
    return (
      <div className="rounded-card border border-line bg-surface p-4">
        <h2 className="text-base font-bold">Supprimer mon compte</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Efface définitivement ton compte, tes images et ton historique.
        </p>
        <Button
          variant="outline"
          size="md"
          block
          className="mt-3 border-danger/50 text-danger hover:bg-danger/10"
          onClick={() => setConfirming(true)}
        >
          <Trash2 className="size-4" aria-hidden />
          Supprimer mon compte
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-card border border-danger/50 bg-danger/5 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden />
        <div className="min-w-0">
          <h2 className="text-base font-bold text-text">C’est définitif</h2>
          <ul className="mt-2 space-y-1 text-sm leading-relaxed text-muted">
            <li>· Ton compte et ton e-mail sont effacés</li>
            <li>· Tes images encore stockées sont supprimées</li>
            <li>· Ton historique de générations est effacé</li>
            {credits > 0 ? (
              <li className="text-danger">
                · Tes {credits} {credits > 1 ? 'crédits restants' : 'crédit restant'}{' '}
                sont perdus, sans remboursement
              </li>
            ) : null}
          </ul>
          <p className="mt-2 text-xs text-muted">
            Les écritures comptables liées à tes achats sont conservées dix ans,
            comme la loi l’exige — elles ne contiennent pas d’image.
          </p>

          {error ? (
            <p className="mt-3 rounded-card bg-danger/15 p-3 text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}

          <div className="mt-4 space-y-2">
            <Button
              variant="danger"
              size="md"
              block
              disabled={deleting}
              onClick={() => void remove()}
            >
              {deleting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Suppression…
                </>
              ) : (
                'Oui, supprimer définitivement'
              )}
            </Button>
            <Button
              variant="ghost"
              size="md"
              block
              disabled={deleting}
              onClick={() => setConfirming(false)}
            >
              Annuler
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

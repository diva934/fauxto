'use client';

import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { browserSupabase, hasBrowserSupabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

/**
 * Connexion par Google, via Supabase.
 *
 * Pourquoi ce bouton compte plus qu'un simple confort : tout le tunnel dépend
 * de la réception d'un lien e-mail, et le SMTP intégré de Supabase est plafonné
 * à quelques envois par heure sur un projet gratuit. Un lien qui tombe en spam
 * ou qui n'arrive pas, c'est un compte non créé, donc une vente perdue. Google
 * supprime entièrement cette dépendance pour la majorité des visiteurs.
 *
 * La redirection passe par `/auth/callback`, qui échange le code contre une
 * session et applique sa liste blanche de destinations — le même chemin que le
 * lien magique, donc aucune surface de redirection ouverte en plus.
 */

/**
 * Marque Google officielle.
 *
 * Les conditions d'usage de « Se connecter avec Google » imposent le logo
 * officiel et interdisent de le recolorer. Il est donc inline plutôt que teinté
 * avec `currentColor`.
 */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-5 shrink-0" aria-hidden focusable="false">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

export function GoogleButton({
  next,
  className,
}: {
  /** Page vers laquelle revenir une fois connecté (le prank en cours). */
  next?: string;
  className?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!hasBrowserSupabase()) return null;

  const signIn = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const destination = next ?? '/compte';
      const { error: authError } = await browserSupabase().auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(destination)}`,
        },
      });

      if (authError) {
        // Le cas le plus fréquent en pratique : le fournisseur Google n'est pas
        // encore activé dans le projet Supabase. On le dit clairement plutôt que
        // de laisser un bouton qui échoue sans explication.
        console.error('[auth] signInWithOAuth :', authError.message);
        setError('La connexion Google est indisponible. Utilise ton e-mail.');
        setLoading(false);
      }
      // En cas de succès la page part vers Google : on garde `loading` à true
      // pour éviter un second clic pendant la redirection.
    } catch {
      setError('Connexion perdue. Réessaie dans un instant.');
      setLoading(false);
    }
  };

  return (
    <div className={className}>
      <button
        type="button"
        disabled={loading}
        onClick={() => void signIn()}
        className={cn(
          'flex min-h-touch w-full items-center justify-center gap-3 rounded-pill',
          'bg-white px-6 font-semibold text-[#1f1f1f] transition-[transform,opacity]',
          'hover:bg-white/90 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        )}
      >
        {loading ? (
          <>
            <Loader2 className="size-5 animate-spin" aria-hidden />
            Redirection…
          </>
        ) : (
          <>
            <GoogleMark />
            Continuer avec Google
          </>
        )}
      </button>

      {error ? (
        <p className="mt-2 rounded-card bg-danger/10 p-3 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

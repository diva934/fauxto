import type { Metadata } from 'next';
import Link from 'next/link';
import { BeforeAfterTile } from '@/components/marketing/BeforeAfterTile';
import { TEMPLATES } from '@/lib/templates';

export const metadata: Metadata = {
  title: 'Choisis ton prank',
  description: 'Dix canulars photo prêts à envoyer. Choisis, uploade, partage.',
};

/**
 * Sélection du template — §3.2.
 *
 * Défilement horizontal avec accrochage, comme demandé. Attention à la nuance :
 * le §8 interdit le défilement horizontal de la PAGE, pas un carrousel contenu.
 * Le conteneur ci-dessous a son propre `overflow-x`, et `body` reste en
 * `overflow-x: hidden` — aucune page ne défile latéralement.
 *
 * Au tap, on va directement à l'upload : aucun écran intermédiaire.
 */
export default function CreerPage() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col safe-top safe-bottom">
      <header className="px-5 pt-2 pb-5">
        <Link
          href="/"
          className="inline-flex min-h-touch items-center text-sm text-muted hover:text-text"
        >
          ← Retour
        </Link>
        <h1 className="mt-1 text-3xl font-extrabold leading-tight tracking-tight">
          Tu piéges qui, et comment ?
        </h1>
        <p className="mt-2 text-base text-muted">
          Choisis un prank, envoie la photo, paie 1 €. C’est tout.
        </p>
      </header>

      {/* Carrousel : 10 cartes, accrochage au centre, sans barre de défilement. */}
      <div className="scroll-snap-x flex gap-3 overflow-x-auto px-5 pb-2">
        {TEMPLATES.map((template, index) => (
          <div key={template.id} className="snap-card w-[62%] shrink-0 sm:w-[46%]">
            <BeforeAfterTile
              template={template}
              priority={index < 2}
              delayMs={index * 400}
            />
            <p className="mt-2 px-0.5 text-sm leading-snug text-muted">
              {template.taglineFr}
            </p>
          </div>
        ))}
      </div>

      <p className="mt-4 px-5 text-center text-xs text-muted">
        Glisse pour voir les {TEMPLATES.length} pranks
      </p>

      <div className="mt-auto px-5 pt-8">
        <p className="rounded-card border border-line bg-surface p-4 text-xs leading-relaxed text-muted">
          Toutes les images produites portent la mention «&nbsp;Image générée par
          IA&nbsp;» et sont supprimées de nos serveurs au bout de 24&nbsp;heures.
          Les photos de personnes mineures sont refusées automatiquement.
        </p>
      </div>
    </main>
  );
}

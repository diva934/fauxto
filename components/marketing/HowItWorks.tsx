import { Camera, Send, Sparkles, Wand2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

/**
 * « Comment ça marche » en quatre étapes.
 *
 * Le cahier des charges initial interdisait toute section au-delà du premier
 * écran. On l'ajoute quand même, parce que l'objection réelle du visiteur n'est
 * pas « qu'est-ce que c'est » (la grille avant/après y répond) mais « combien de
 * temps ça va me prendre ». Quatre étapes numérotées répondent à ça en trois
 * secondes de lecture, et le CTA est répété juste en dessous : la section
 * n'éloigne donc personne du bouton.
 */

const STEPS = [
  {
    icon: Wand2,
    titleFr: 'Choisis ton prank',
    bodyFr:
      'Dix scénarios prêts à l’emploi. Pas de prompt à écrire, pas de réglage à comprendre.',
  },
  {
    icon: Camera,
    titleFr: 'Envoie la photo',
    bodyFr:
      'Depuis ta galerie ou en la prenant sur le moment. Plus elle est nette, meilleur c’est.',
  },
  {
    icon: Sparkles,
    titleFr: 'L’IA travaille',
    bodyFr:
      'Une dizaine de secondes. Si ça rate, ton crédit t’est rendu automatiquement.',
  },
  {
    icon: Send,
    titleFr: 'Envoie et attends',
    bodyFr:
      'Un tap vers WhatsApp ou Snap. Le plus dur, c’est de ne pas rire trop vite.',
  },
] as const;

export function HowItWorks() {
  return (
    <section className="px-5 py-12" aria-labelledby="comment-ca-marche">
      <p className="text-center text-[11px] font-bold tracking-[0.2em] text-accent-strong">
        COMMENT ÇA MARCHE
      </p>
      <h2
        id="comment-ca-marche"
        className="mt-2 text-center text-3xl font-extrabold leading-tight tracking-tight text-balance"
      >
        Compte trente secondes
      </h2>

      <ol className="mt-8 space-y-3">
        {STEPS.map((step, index) => (
          <li
            key={step.titleFr}
            className="bg-glass flex gap-4 rounded-card p-4 backdrop-blur-sm"
          >
            <div className="flex shrink-0 flex-col items-center gap-2">
              <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-ink">
                <step.icon className="size-5" aria-hidden />
              </span>
              <span className="text-[11px] font-bold tabular-nums text-muted">
                0{index + 1}
              </span>
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-bold leading-snug">{step.titleFr}</h3>
              <p className="mt-1 text-[15px] leading-snug text-muted">{step.bodyFr}</p>
            </div>
          </li>
        ))}
      </ol>

      <Button asChild size="xl" block className="mt-8 text-lg">
        <Link href="/creer">Piéger un pote</Link>
      </Button>
      <p className="mt-2 text-center text-xs text-muted">
        La première est offerte, sans créer de compte
      </p>
    </section>
  );
}

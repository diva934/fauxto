import { Check, Infinity as InfinityIcon, ShieldCheck, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { Faq } from '@/components/marketing/Faq';
import { HowItWorks } from '@/components/marketing/HowItWorks';
import { BeforeAfterTile } from '@/components/marketing/BeforeAfterTile';
import { Button } from '@/components/ui/button';
import { getWeeklyGenerationCount } from '@/lib/credits';
import { TEMPLATES } from '@/lib/templates';
import { formatCount } from '@/lib/utils';

/**
 * Accueil.
 *
 * La structure suit ce qui fonctionne réellement sur ce marché : compteur au-
 * dessus du titre, mur avant/après dense, garanties, « comment ça marche », FAQ,
 * et le CTA répété trois fois. Le cahier des charges initial interdisait toute
 * section au-delà du premier écran ; on s'en écarte volontairement, parce que
 * répéter le CTA règle le problème que cette règle cherchait à éviter (enterrer
 * le bouton) sans priver le visiteur des réponses dont il a besoin pour payer.
 *
 * Ce qu'on ne reprend PAS aux concurrents :
 *   · la promesse d'un résultat « indétectable » — elle contredirait la mention
 *     légale que le produit incruste dans chaque image ;
 *   · une note et un nombre d'avis. Aucun avis n'existe : les inventer serait de
 *     la publicité trompeuse. Le seul chiffre affiché est lu en base.
 */

export const revalidate = 300;

export default async function HomePage() {
  const weeklyCount = await getWeeklyGenerationCount();

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col">
      {/* ── Barre haute ──────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-5 pt-3 safe-top">
        <span className="text-base font-extrabold tracking-tight">
          FAUX<span className="text-accent-strong">TO</span>
        </span>
        {/* Un seul lien de navigation : les acheteurs doivent pouvoir
            retrouver leurs crédits sur un autre appareil. */}
        <Link
          href="/compte"
          className="inline-flex min-h-touch items-center px-2 text-sm text-muted hover:text-text"
        >
          Mon compte
        </Link>
      </header>

      {/* ── Héros ────────────────────────────────────────────────────────── */}
      <section className="px-5 pt-4">
        {weeklyCount !== null && weeklyCount > 0 ? (
          <p className="bg-glass mx-auto flex w-fit items-center gap-1.5 rounded-pill px-3 py-1.5 text-xs">
            <Sparkles className="size-3.5 text-accent-strong" aria-hidden />
            <span className="font-bold tabular-nums">{formatCount(weeklyCount)}</span>
            <span className="text-muted">photos cette semaine</span>
          </p>
        ) : (
          <p className="bg-glass mx-auto flex w-fit items-center gap-1.5 rounded-pill px-3 py-1.5 text-xs">
            <Sparkles className="size-3.5 text-accent-strong" aria-hidden />
            <span className="font-bold">Première photo offerte</span>
            <span className="text-muted">sans inscription</span>
          </p>
        )}

        <h1 className="mt-4 text-center text-[2.6rem] font-extrabold leading-[0.98] tracking-tight text-balance">
          Envoie à ton pote
          <br />
          <span className="text-accent-strong">une photo</span> qu’il va croire
        </h1>

        <p className="mx-auto mt-3 max-w-sm text-center text-[17px] leading-snug text-muted">
          Sa voiture rayée, sa coupe ratée, lui dans quarante ans. Tu choisis, tu
          envoies une photo, c’est prêt en dix secondes.
        </p>

        <Button asChild size="xl" block className="glow-accent mt-6 text-lg">
          <Link href="/creer">Créer ma photo</Link>
        </Button>

        {/* Garanties réelles, vérifiables dans les CGV. Pas de note inventée. */}
        <ul className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[13px] text-muted">
          <li className="flex items-center gap-1.5">
            <Check className="size-3.5 text-accent-strong" aria-hidden />
            Sans compte
          </li>
          <li className="flex items-center gap-1.5">
            <InfinityIcon className="size-3.5 text-accent-strong" aria-hidden />
            Crédits sans expiration
          </li>
          <li className="flex items-center gap-1.5">
            <ShieldCheck className="size-3.5 text-accent-strong" aria-hidden />
            Échec = remboursé
          </li>
        </ul>
      </section>

      {/* ── Mur avant/après ──────────────────────────────────────────────── */}
      <section className="px-5 pt-10" aria-labelledby="pranks">
        <h2 id="pranks" className="sr-only">
          Les dix pranks disponibles
        </h2>
        <div className="grid grid-cols-2 gap-2.5">
          {TEMPLATES.map((template, index) => (
            <BeforeAfterTile
              key={template.id}
              template={template}
              priority={index < 2}
              delayMs={index * 340}
            />
          ))}
        </div>
      </section>

      <HowItWorks />
      <Faq />

      {/* ── CTA final ────────────────────────────────────────────────────── */}
      <section className="px-5 pb-10">
        <div className="bg-glass rounded-card p-6 text-center">
          <h2 className="text-2xl font-extrabold leading-tight tracking-tight">
            Alors, tu piéges qui ?
          </h2>
          <p className="mx-auto mt-2 max-w-xs text-[15px] leading-snug text-muted">
            La première est offerte. Pas de compte, pas de carte, pas de raison
            d’hésiter.
          </p>
          <Button asChild size="xl" block className="glow-accent mt-5 text-lg">
            <Link href="/creer">Créer ma photo</Link>
          </Button>
        </div>
      </section>

      {/* ── Pied de page ─────────────────────────────────────────────────── */}
      <footer className="border-t border-line px-5 pb-4 safe-bottom">
        <p className="pt-5 text-[11px] leading-relaxed text-muted">
          Toutes les images produites portent la mention «&nbsp;Image générée par
          IA&nbsp;» incrustée et des métadonnées de provenance, conformément à
          l’article 50 du règlement européen sur l’IA. Elles sont supprimées de
          nos serveurs sous 24&nbsp;heures. Les photos de personnes mineures sont
          refusées automatiquement.
        </p>
        <nav className="mt-2 flex flex-wrap items-center gap-x-1 text-[11px] text-muted">
          {[
            { href: '/mentions-legales', label: 'Mentions légales' },
            { href: '/confidentialite', label: 'Confidentialité' },
            { href: '/cgv', label: 'CGV' },
            { href: '/cgu', label: 'CGU' },
            { href: '/signaler', label: 'Signaler une image' },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="inline-flex min-h-touch items-center px-2 hover:text-text"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </footer>
    </main>
  );
}

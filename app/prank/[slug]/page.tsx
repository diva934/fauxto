import { ArrowRight, Clock, ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BeforeAfterTile } from '@/components/marketing/BeforeAfterTile';
import { Button } from '@/components/ui/button';
import { getTemplateBySlug, TEMPLATES } from '@/lib/templates';
import { BRAND } from '@/lib/utils';

/**
 * Page SEO d'un prank — une par template.
 *
 * POURQUOI ELLES EXISTENT. Le sitemap annonçait ces dix URL depuis le début,
 * mais elles n'avaient jamais été écrites : chacune renvoyait un 404. Un plan
 * de site qui déclare des pages inexistantes est le genre de signal qui coûte
 * durablement en référencement, et c'est dix requêtes distinctes perdues —
 * « photo voiture rayée IA » n'est pas « photo coupe de cheveux ratée IA ».
 *
 * Ce sont des pages statiques : aucune donnée dynamique, donc rien à
 * revalider. Elles sont générées au build, une fois pour toutes.
 */

export function generateStaticParams() {
  return TEMPLATES.map((template) => ({ slug: template.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const template = getTemplateBySlug(slug);

  if (!template) return { title: 'Prank introuvable' };

  const title = `${template.nameFr} — photo canular par IA`;

  return {
    title,
    description: template.descriptionFr,
    alternates: { canonical: `/prank/${template.slug}` },
    openGraph: {
      title: `${title} — ${BRAND.name}`,
      description: template.descriptionFr,
      images: [{ url: template.thumbnailAfter }],
    },
  };
}

export default async function PrankPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const template = getTemplateBySlug(slug);

  if (!template) notFound();

  // Trois autres pranks, pour donner au visiteur une raison de rester et au
  // moteur des liens internes entre les dix pages.
  const others = TEMPLATES.filter((t) => t.slug !== template.slug).slice(0, 4);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: `Créer une photo « ${template.nameFr} » avec l’IA`,
    description: template.descriptionFr,
    inLanguage: 'fr-FR',
    totalTime: 'PT1M',
    step: [
      { '@type': 'HowToStep', name: 'Choisir la photo', text: 'Envoie une photo depuis ton téléphone.' },
      { '@type': 'HowToStep', name: 'Générer', text: `L’IA applique le scénario « ${template.nameFr} » en quelques secondes.` },
      { '@type': 'HowToStep', name: 'Partager', text: 'Télécharge le résultat et envoie-le.' },
    ],
  };

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 safe-top safe-bottom">
      <script
        type="application/ld+json"
        // Données dérivées d'un template statique, aucune entrée utilisateur.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className="py-4">
        <Link
          href="/"
          className="inline-flex min-h-touch items-center text-sm text-muted hover:text-text"
        >
          ← {BRAND.name}
        </Link>
        <h1 className="mt-1 text-3xl font-extrabold leading-tight tracking-tight text-balance">
          {template.emoji} {template.nameFr}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">{template.descriptionFr}</p>
      </header>

      <div className="overflow-hidden rounded-card">
        <BeforeAfterTile template={template} priority />
      </div>

      <div className="mt-5">
        <Button asChild size="lg" block>
          <Link href={`/creer/${template.id}`}>
            Faire cette photo <ArrowRight className="size-5" aria-hidden />
          </Link>
        </Button>
      </div>

      <ul className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <li className="flex items-center gap-1.5 rounded-card border border-line bg-surface p-3 text-muted">
          <Clock className="size-4 shrink-0 text-accent-strong" aria-hidden />
          Prêt en quelques secondes
        </li>
        <li className="flex items-center gap-1.5 rounded-card border border-line bg-surface p-3 text-muted">
          <ShieldCheck className="size-4 shrink-0 text-accent-strong" aria-hidden />
          Photo effacée sous 24 h
        </li>
      </ul>

      <section className="mt-8">
        <h2 className="text-lg font-extrabold tracking-tight">Comment ça marche</h2>
        <ol className="mt-3 space-y-3 text-sm leading-relaxed text-muted">
          <li>
            <strong className="text-text">1. Tu envoies une photo.</strong> Celle
            de la voiture, du salon, du visage — ce que demande le scénario.
          </li>
          <li>
            <strong className="text-text">2. L’IA la modifie.</strong> Elle
            applique uniquement le scénario « {template.nameFr} » et laisse le
            reste intact.
          </li>
          <li>
            <strong className="text-text">3. Tu partages.</strong> Tu télécharges
            le résultat et tu l’envoies. À toi de dire que c’est une image
            générée quand tu le fais.
          </li>
        </ol>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-extrabold tracking-tight">Les autres pranks</h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {others.map((other) => (
            <Link
              key={other.slug}
              href={`/prank/${other.slug}`}
              className="rounded-card border border-line bg-surface p-3 text-sm hover:border-accent"
            >
              <span aria-hidden>{other.emoji}</span>{' '}
              <span className="font-bold">{other.nameFr}</span>
              <span className="mt-0.5 block text-xs text-muted">{other.taglineFr}</span>
            </Link>
          ))}
        </div>
        <Link
          href="/creer"
          className="mt-3 inline-flex min-h-touch items-center text-sm text-accent-strong hover:underline"
        >
          Voir les {TEMPLATES.length} pranks →
        </Link>
      </section>

      <p className="mt-8 pb-4 text-[11px] leading-relaxed text-muted">
        Les images produites sont fictives et portent des métadonnées de
        provenance, conformément à l’article 50 du règlement européen sur l’IA.
        Elles sont supprimées de nos serveurs sous 24 heures. Les photos de
        personnes mineures sont refusées automatiquement.
      </p>
    </main>
  );
}

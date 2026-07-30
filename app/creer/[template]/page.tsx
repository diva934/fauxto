import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PrankFlow } from '@/components/funnel/PrankFlow';
import { getCredits } from '@/lib/credits';
import { currentUser } from '@/lib/supabase/server';
import { getTemplateById, TEMPLATES } from '@/lib/templates';

/** Les 10 pages sont connues à l'avance : on les prérend. */
export function generateStaticParams(): { template: string }[] {
  return TEMPLATES.map((template) => ({ template: template.id }));
}

// Next 16 : `params` est une promesse, y compris dans generateMetadata.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ template: string }>;
}): Promise<Metadata> {
  const { template: templateId } = await params;
  const template = getTemplateById(templateId);
  if (!template) return { title: 'Prank introuvable' };

  return {
    title: template.nameFr,
    description: template.descriptionFr,
    // Cette page est le tunnel de conversion, pas une page d'atterrissage SEO :
    // c'est /prank/[slug] qui est indexée.
    robots: { index: false, follow: true },
  };
}

// Le solde de crédits est lu à chaque affichage : une page mise en cache
// afficherait « Payer 1 € » à quelqu'un qui vient justement de payer.
export const dynamic = 'force-dynamic';

export default async function TemplateFlowPage({
  params,
}: {
  params: Promise<{ template: string }>;
}) {
  const { template: templateId } = await params;
  const template = getTemplateById(templateId);
  if (!template) notFound();

  const user = await currentUser();
  const credits = user ? await getCredits(user.id) : 0;

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col safe-top safe-bottom">
      <header className="px-5 pt-2 pb-4">
        <Link
          href="/creer"
          className="inline-flex min-h-touch items-center text-sm text-muted hover:text-text"
        >
          ← Changer de prank
        </Link>
        <h1 className="mt-1 text-2xl font-extrabold leading-tight tracking-tight">
          {template.emoji} {template.nameFr}
        </h1>
        <p className="mt-1 text-sm leading-snug text-muted">{template.taglineFr}</p>
      </header>

      <PrankFlow template={template} isSignedIn={Boolean(user)} credits={credits} />
    </main>
  );
}

import { CheckCircle2, Mail } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Merci',
  robots: { index: false, follow: false },
};

/**
 * Retour de Stripe après paiement.
 *
 * Cette page ne crédite RIEN et ne fait confiance à aucun paramètre d'URL : le
 * crédit est accordé exclusivement par le webhook signé. Un utilisateur qui
 * arriverait ici en forgeant `session_id` ne gagnerait rien.
 */
export default async function MerciPage({
  searchParams,
}: {
  searchParams: Promise<{ retour?: string }>;
}) {
  const { retour } = await searchParams;
  // Même liste blanche qu'ailleurs : un `retour` arbitraire ferait de cette
  // page une redirection ouverte, juste après une saisie de carte.
  const returnPath =
    retour && /^\/creer\/[a-z0-9-]{1,60}$/.test(retour) ? retour : '/creer';
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-6 text-center safe-top safe-bottom">
      <div className="flex size-16 items-center justify-center rounded-full bg-success/15">
        <CheckCircle2 className="size-9 text-success" aria-hidden />
      </div>

      <h1 className="mt-5 text-3xl font-extrabold leading-tight tracking-tight">
        Paiement reçu
      </h1>
      <p className="mt-3 max-w-sm text-base leading-snug text-muted">
        Tes crédits sont en route. Ils apparaissent dès que Stripe nous confirme le
        paiement — quelques secondes en général.
      </p>

      <div className="mt-6 flex w-full max-w-sm items-start gap-3 rounded-card border border-line bg-surface p-4 text-left">
        <Mail className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
        <p className="text-sm text-muted">
          <strong className="text-text">Ta photo t’attend.</strong> Reprends là où
          tu en étais — on l’a gardée pendant le paiement.
        </p>
      </div>

      <div className="mt-6 w-full max-w-sm space-y-2">
        <Button asChild block size="lg">
          <Link href={returnPath}>Générer ma photo</Link>
        </Button>
        <Button asChild variant="ghost" block size="md">
          <Link href="/compte">Voir mon solde</Link>
        </Button>
      </div>
    </main>
  );
}

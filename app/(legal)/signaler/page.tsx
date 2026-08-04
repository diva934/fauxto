import type { Metadata } from 'next';
import { ReportForm } from '@/components/legal/ReportForm';
import { ToComplete } from '@/components/legal/ToComplete';
import { LEGAL_ENTITY } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Signaler une image',
  description:
    'Signaler une image générée par Fauxto : personne mineure, contenu sexuel, droit à l’image, harcèlement.',
  robots: { index: true, follow: true },
};

export default function SignalerPage() {
  return (
    <>
      <h1>Signaler une image</h1>
      <p>
        Ce formulaire est ouvert à tout le monde, y compris aux personnes qui
        n’utilisent pas le service. Tu n’as pas besoin de compte.
      </p>
      <p>
        Les signalements concernant une <strong>personne mineure</strong> ou un{' '}
        <strong>contenu à caractère sexuel</strong>
        {' '}sont traités en priorité absolue. Les autres le sont sous
        72&nbsp;heures au plus tard.
      </p>

      <div className="not-prose my-6">
        <ReportForm />
      </div>

      <h2>Si tu apparais sur une image</h2>
      <p>
        Tu peux demander la suppression et t’opposer au traitement. Deux choses
        utiles à savoir avant de nous écrire :
      </p>
      <ul>
        <li>
          Les images sont <strong>supprimées automatiquement de nos serveurs
          sous 24&nbsp;heures</strong>. Celle qui te concerne a donc
          probablement déjà disparu de notre côté.
        </li>
        <li>
          En revanche, nous n’avons aucun contrôle sur une copie déjà partagée
          ailleurs. Si l’image circule, conserve-la comme preuve : elle porte des
          métadonnées de provenance et un marquage machine-lisible, qui
          établissent son caractère artificiel à l’analyse.
        </li>
      </ul>

      <h2>Autres voies</h2>
      <p>
        Par e-mail :{' '}
        <ToComplete value={LEGAL_ENTITY.contactEmail} label="e-mail de contact" />
      </p>
      <p>
        Tu peux aussi saisir la CNIL à tout moment —{' '}
        <a
          href="https://www.cnil.fr/fr/plaintes"
          target="_blank"
          rel="noreferrer noopener"
        >
          cnil.fr/fr/plaintes
        </a>
        . Nous préférons régler la situation directement, mais ce droit ne dépend
        pas de nous.
      </p>
      <p>
        Si tu penses qu’une infraction a été commise (harcèlement, diffusion
        d’une image truquée présentée comme authentique), tu peux également
        déposer plainte auprès des services de police ou de gendarmerie, ou via{' '}
        <a
          href="https://www.internet-signalement.gouv.fr/"
          target="_blank"
          rel="noreferrer noopener"
        >
          internet-signalement.gouv.fr
        </a>
        .
      </p>
    </>
  );
}

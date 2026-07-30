import type { Metadata } from 'next';
import { ToComplete } from '@/components/legal/ToComplete';
import { LAST_UPDATED, LEGAL_ENTITY } from '@/lib/legal';
import { BRAND } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Mentions légales',
  description: `Mentions légales du service ${BRAND.name}.`,
  robots: { index: true, follow: true },
};

export default function MentionsLegalesPage() {
  return (
    <>
      <h1>Mentions légales</h1>
      <p className="!text-sm">Dernière mise à jour : {LAST_UPDATED}</p>

      <h2>1. Éditeur du site</h2>
      <p>
        Le site {BRAND.domain} est édité par :
      </p>
      <ul>
        <li>
          <strong>Dénomination</strong> :{' '}
          <ToComplete value={LEGAL_ENTITY.companyName} label="raison sociale" />
        </li>
        <li>
          <strong>Forme juridique</strong> :{' '}
          <ToComplete value={LEGAL_ENTITY.legalForm} label="forme juridique" />
        </li>
        <li>
          <strong>Siège social</strong> :{' '}
          <ToComplete value={LEGAL_ENTITY.address} label="adresse du siège" />
        </li>
        <li>
          <strong>SIRET</strong> :{' '}
          <ToComplete value={LEGAL_ENTITY.siret} label="numéro SIRET" />
        </li>
        <li>
          <strong>TVA intracommunautaire</strong> :{' '}
          <ToComplete
            value={LEGAL_ENTITY.vatNumber}
            label="numéro de TVA, ou « non assujetti »"
          />
        </li>
        <li>
          <strong>Responsable de la publication</strong> :{' '}
          <ToComplete value={LEGAL_ENTITY.publisher} label="nom du responsable" />
        </li>
        <li>
          <strong>Contact</strong> :{' '}
          <ToComplete value={LEGAL_ENTITY.contactEmail} label="e-mail de contact" />
        </li>
      </ul>

      <h2>2. Hébergement</h2>
      <p>
        Le site est hébergé par <strong>{LEGAL_ENTITY.host}</strong> —{' '}
        <a href={LEGAL_ENTITY.hostContact} target="_blank" rel="noreferrer noopener">
          {LEGAL_ENTITY.hostContact}
        </a>
        .
      </p>
      <p>
        Les données applicatives (base de données, stockage des images,
        authentification) sont hébergées par <strong>Supabase Inc.</strong>, dans la
        région européenne du projet.
      </p>

      <h2>3. Nature du service</h2>
      <p>
        {BRAND.name} est un service de modification d’images par intelligence
        artificielle générative, destiné au divertissement. Les images produites
        sont des <strong>représentations fictives</strong> : elles ne constituent
        ni un document, ni une preuve, ni le témoignage d’un fait réel.
      </p>
      <p>
        Conformément à l’article 50 du règlement (UE) 2024/1689 sur
        l’intelligence artificielle, applicable depuis le 2 août 2026, toute image
        produite par le service porte :
      </p>
      <ul>
        <li>
          une <strong>mention visible</strong> «&nbsp;Image générée par IA&nbsp;»
          incrustée dans l’image elle-même ;
        </li>
        <li>
          des <strong>métadonnées de provenance C2PA</strong> indiquant le modèle
          utilisé et la date de génération ;
        </li>
        <li>
          un <strong>marquage machine-lisible</strong> (SynthID) incorporé par le
          modèle générateur.
        </li>
      </ul>
      <p>
        Ces marquages ne sont retirés dans aucune circonstance, y compris pour les
        utilisateurs ayant acheté des crédits.
      </p>

      <h2>4. Propriété intellectuelle</h2>
      <p>
        La structure du site, son identité visuelle et ses textes sont protégés.
        Toute reproduction sans autorisation est interdite.
      </p>
      <p>
        Les photographies transmises par les utilisateurs restent leur propriété,
        ou celle de leurs ayants droit. L’éditeur n’acquiert aucun droit sur
        celles-ci et ne les utilise ni pour l’entraînement de modèles, ni à des
        fins promotionnelles. Elles sont supprimées dans un délai maximal de
        24&nbsp;heures.
      </p>

      <h2>5. Responsabilité de l’utilisateur</h2>
      <p>
        L’utilisateur est seul responsable des photographies qu’il transmet et de
        l’usage qu’il fait des images produites. Il garantit disposer des droits
        nécessaires sur chaque photographie envoyée et confirme, à chaque
        génération, que la personne représentée est majeure.
      </p>
      <p>
        La diffusion d’une image modifiée dans l’intention de nuire, de diffamer,
        de harceler ou de tromper sur des faits est susceptible de constituer une
        infraction pénale, notamment au titre des articles 226-8 et 226-8-1 du code
        pénal. Le caractère humoristique du service ne fait pas disparaître cette
        responsabilité.
      </p>

      <h2>6. Signalement</h2>
      <p>
        Toute personne peut signaler une image la concernant via la page{' '}
        <a href="/signaler">Signaler une image</a>. Les signalements sont traités
        dans les meilleurs délais, et au plus tard sous 72&nbsp;heures.
      </p>

      <h2>7. Droit applicable</h2>
      <p>
        Les présentes mentions sont soumises au droit français. En cas de litige,
        et à défaut de résolution amiable, les tribunaux français sont compétents.
      </p>
    </>
  );
}

import type { Metadata } from 'next';
import { ToComplete } from '@/components/legal/ToComplete';
import { LAST_UPDATED, LEGAL_ENTITY } from '@/lib/legal';
import { BRAND } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Conditions générales d’utilisation',
  description: `Règles d’usage du service ${BRAND.name}.`,
  robots: { index: true, follow: true },
};

export default function CguPage() {
  return (
    <>
      <h1>Conditions générales d’utilisation</h1>
      <p className="!text-sm">Dernière mise à jour : {LAST_UPDATED}</p>

      <p>
        En utilisant {BRAND.domain}, tu acceptes ces règles. Elles sont courtes et
        elles servent surtout à une chose : que le service reste un divertissement
        et ne devienne pas un outil de nuisance.
      </p>

      <h2>1. Accès au service</h2>
      <p>
        Le service est accessible sans création de compte pour une première
        génération. L’achat de crédits entraîne la création d’un compte associé à
        ton adresse e-mail. Le service est réservé aux personnes majeures.
      </p>

      <h2>2. Ce que tu t’engages à faire</h2>
      <ul>
        <li>
          <strong>N’envoyer que des photographies dont tu as le droit de
          disposer.</strong> Tu le confirmes explicitement à chaque génération.
        </li>
        <li>
          <strong>N’envoyer que des photographies de personnes majeures.</strong>
        </li>
        <li>
          Utiliser les images produites dans un cadre privé et humoristique, entre
          personnes qui se connaissent.
        </li>
        <li>
          Dire la vérité rapidement. Un canular qui dure devient une tromperie.
        </li>
      </ul>

      <h2>3. Ce qui est interdit</h2>
      <p>
        Les usages suivants entraînent la suspension immédiate du compte, et
        peuvent être signalés aux autorités :
      </p>
      <ul>
        <li>
          <strong>Toute photographie de personne mineure.</strong> Sans exception,
          sans contexte atténuant, sans contournement possible.
        </li>
        <li>Contenus à caractère sexuel, nudité, ou contenus dégradants.</li>
        <li>
          Images de personnalités publiques identifiables — élus, artistes,
          sportifs, personnalités médiatiques.
        </li>
        <li>
          Usage à des fins de <strong>harcèlement</strong>, d’intimidation, de
          chantage, de diffamation ou de vengeance.
        </li>
        <li>
          Diffusion d’une image modifiée en la présentant comme <strong>authentique</strong>,
          notamment dans un contexte politique, journalistique, judiciaire,
          professionnel ou assurantiel.
        </li>
        <li>
          Retrait, masquage, recadrage ou altération de la mention «&nbsp;Image
          générée par IA&nbsp;» ou des métadonnées de provenance.
        </li>
        <li>
          Contournement des filtres de modération, automatisation des requêtes,
          revente de l’accès.
        </li>
      </ul>

      <h2>4. Modération automatique</h2>
      <p>
        Chaque photographie envoyée est analysée automatiquement avant génération.
        Le service refuse notamment les images de personnes mineures, les contenus
        sexuels, les personnalités publiques, et les scènes évoquant la
        criminalité, la maladie, la violence ou le décès.
      </p>
      <p>
        <strong>En cas de doute, le service refuse.</strong> Un refus injustifié est
        préférable à une génération qui n’aurait pas dû avoir lieu. Un refus ne
        consomme aucun crédit.
      </p>
      <p>
        Aucun template proposé ne met en scène la criminalité, la maladie, un
        décès, une arrestation ou un accident corporel. Ce n’est pas une question de
        goût : ce type d’image constitue une atteinte potentielle à la
        réputation, avec des conséquences juridiques réelles.
      </p>

      <h2>5. Nature des images produites</h2>
      <p>
        Les images générées sont <strong>fictives</strong>. Elles ne documentent
        aucun fait. Chacune porte, de manière indélébile, la mention «&nbsp;Image
        générée par IA&nbsp;», des métadonnées de provenance C2PA et un marquage
        machine-lisible.
      </p>

      <h2>6. Disponibilité</h2>
      <p>
        Le service est fourni «&nbsp;en l’état&nbsp;». Il dépend de prestataires
        tiers et peut connaître des interruptions. Aucune disponibilité n’est
        garantie contractuellement. En cas d’indisponibilité, les crédits ne sont
        pas consommés.
      </p>

      <h2>7. Signalement</h2>
      <p>
        Si tu apparais sur une image produite par le service, ou si tu constates un
        usage abusif, utilise la page <a href="/signaler">Signaler une image</a>.
        Les signalements concernant une personne mineure ou un contenu sexuel sont
        traités en priorité absolue.
      </p>

      <h2>8. Suppression de ton compte</h2>
      <p>
        Tu peux supprimer ton compte et l’ensemble de tes données à tout moment,
        en deux clics, depuis la page <a href="/compte">Mon compte</a>. La
        suppression est définitive et entraîne la perte des crédits restants.
      </p>

      <h2>9. Contact</h2>
      <p>
        <ToComplete value={LEGAL_ENTITY.contactEmail} label="e-mail de contact" />
      </p>
    </>
  );
}

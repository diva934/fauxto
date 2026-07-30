import type { Metadata } from 'next';
import { ToComplete } from '@/components/legal/ToComplete';
import { LAST_UPDATED, LEGAL_ENTITY, SUBPROCESSORS } from '@/lib/legal';
import { BRAND } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Politique de confidentialité',
  description: `Comment ${BRAND.name} traite tes données et celles des personnes photographiées.`,
  robots: { index: true, follow: true },
};

export default function ConfidentialitePage() {
  return (
    <>
      <h1>Politique de confidentialité</h1>
      <p className="!text-sm">Dernière mise à jour : {LAST_UPDATED}</p>

      <p>
        Cette page explique quelles données {BRAND.name} traite, pourquoi, combien
        de temps, et à qui elles sont transmises. Elle est écrite pour être
        comprise, pas pour être imbuvable.
      </p>

      <h2>1. Responsable du traitement</h2>
      <p>
        <ToComplete value={LEGAL_ENTITY.companyName} label="raison sociale" />,{' '}
        <ToComplete value={LEGAL_ENTITY.address} label="adresse du siège" />.
        Contact : <ToComplete value={LEGAL_ENTITY.contactEmail} label="e-mail de contact" />
      </p>

      <h2>2. Le point le plus important : les photos</h2>
      <p>
        Une photographie de visage est une donnée personnelle, et peut constituer
        une donnée biométrique. Elle est donc traitée avec le régime le plus
        strict :
      </p>
      <ul>
        <li>
          <strong>Suppression automatique sous 24&nbsp;heures.</strong> La photo
          source n’est jamais conservée après le traitement ; l’image produite est
          supprimée du stockage au plus tard 24&nbsp;heures après sa création, par
          une tâche automatique qui s’exécute chaque heure.
        </li>
        <li>
          <strong>Aucun entraînement de modèle.</strong> Les images ne servent
          jamais à entraîner ou affiner un modèle, ni le nôtre ni celui d’un tiers.
        </li>
        <li>
          <strong>Aucune reconnaissance faciale.</strong> Aucun gabarit
          biométrique n’est calculé, stocké ou comparé. L’analyse automatique
          effectuée avant génération sert uniquement à refuser les contenus
          interdits, et son résultat n’est conservé que sous forme d’un motif de
          refus (par exemple «&nbsp;mineur&nbsp;»), sans l’image.
        </li>
        <li>
          <strong>Stockage privé.</strong> Les images sont déposées dans un espace
          non public et ne sont accessibles que par lien signé à durée limitée.
        </li>
      </ul>

      <h2>3. La personne photographiée n’est pas toi</h2>
      <p>
        C’est la particularité de ce service, et nous préférons l’écrire
        clairement : la personne représentée sur la photo n’est en général pas
        celle qui l’envoie, et elle n’a pas donné son accord.
      </p>
      <p>
        C’est pourquoi, à chaque génération, tu confirmes disposer du droit
        d’utiliser la photo. Cette confirmation est ta responsabilité, et elle
        conditionne la licéité du traitement. En complément, le service refuse
        automatiquement les photographies de personnes mineures, les contenus à
        caractère sexuel, les personnalités publiques identifiables, et les scènes
        évoquant la criminalité, la maladie, la violence ou le décès.
      </p>
      <p>
        <strong>
          Si tu apparais sur une image produite par ce service et que tu ne le
          souhaites pas
        </strong>
        , utilise la page <a href="/signaler">Signaler une image</a>. Nous
        traitons ces demandes en priorité. Compte tenu de la suppression
        automatique sous 24&nbsp;heures, l’image aura le plus souvent déjà disparu
        de nos serveurs — mais nous te répondrons et bloquerons ce qui peut l’être.
      </p>

      <h2>4. Données traitées, finalités et durées</h2>
      <table>
        <thead>
          <tr>
            <th>Donnée</th>
            <th>Finalité</th>
            <th>Base légale</th>
            <th>Durée</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Photographie envoyée</td>
            <td>Produire l’image demandée</td>
            <td>Exécution du service (art. 6.1.b)</td>
            <td>Le temps du traitement</td>
          </tr>
          <tr>
            <td>Image produite</td>
            <td>Te la remettre et te permettre de la partager</td>
            <td>Exécution du service (art. 6.1.b)</td>
            <td>24 heures maximum</td>
          </tr>
          <tr>
            <td>
              Empreinte technique (condensé salé de l’adresse IP et du navigateur)
            </td>
            <td>Limiter les abus (débit de requêtes)</td>
            <td>Intérêt légitime (art. 6.1.f)</td>
            <td>12 mois</td>
          </tr>
          <tr>
            <td>Adresse e-mail</td>
            <td>Créer ton compte à l’achat et t’envoyer ton lien de connexion</td>
            <td>Exécution du contrat (art. 6.1.b)</td>
            <td>Jusqu’à suppression du compte</td>
          </tr>
          <tr>
            <td>Historique des crédits</td>
            <td>Justifier ton solde et tes achats</td>
            <td>Obligation comptable (art. 6.1.c)</td>
            <td>10 ans (durée légale de conservation comptable)</td>
          </tr>
          <tr>
            <td>Motif de refus de modération</td>
            <td>Prouver que les obligations de filtrage sont appliquées</td>
            <td>Obligation légale (art. 6.1.c)</td>
            <td>12 mois, sans l’image</td>
          </tr>
        </tbody>
      </table>

      <h2>5. Aucune adresse IP en clair</h2>
      <p>
        Nous n’enregistrons jamais d’adresse IP en clair dans notre base. Pour
        limiter les abus, l’adresse IP et le navigateur sont transformés en une
        empreinte par une fonction HMAC-SHA256 salée par une clé secrète. Cette
        empreinte ne permet pas de retrouver l’adresse IP, et n’est comparable à
        aucune autre base.
      </p>
      <p>
        Les journaux techniques temporaires de notre hébergeur peuvent contenir des
        adresses IP, pendant une durée courte et sans que nous y accédions à des
        fins de profilage.
      </p>

      <h2>6. Sous-traitants et transferts</h2>
      <p>
        Nous nommons explicitement les prestataires qui traitent des données pour
        notre compte. <strong>Les photographies que tu envoies sont transmises à
        Google</strong> pour être traitées par l’API Gemini : c’est le cœur du
        service, et il n’est pas possible de s’en dispenser.
      </p>
      <table>
        <thead>
          <tr>
            <th>Prestataire</th>
            <th>Rôle</th>
            <th>Localisation</th>
            <th>Encadrement</th>
          </tr>
        </thead>
        <tbody>
          {SUBPROCESSORS.map((sub) => (
            <tr key={sub.name}>
              <td>
                <strong>{sub.name}</strong>
              </td>
              <td>{sub.purpose}</td>
              <td>{sub.location}</td>
              <td>{sub.safeguard}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>7. Mesure d’audience sans cookie</h2>
      <p>
        Nous utilisons une solution de mesure d’audience sans cookie, qui ne dépose
        rien sur ton appareil et ne construit aucun profil individuel. C’est la
        raison pour laquelle ce site n’affiche <strong>aucun bandeau de
        consentement</strong> : il n’y a rien à consentir.
      </p>

      <h2>8. Tes droits</h2>
      <p>
        Tu disposes d’un droit d’accès, de rectification, d’effacement, de
        limitation, d’opposition et de portabilité sur tes données.
      </p>
      <ul>
        <li>
          <strong>Supprimer ton compte et toutes tes données</strong> : depuis la
          page <a href="/compte">Mon compte</a>, en deux clics, sans nous écrire.
        </li>
        <li>
          <strong>Nous contacter</strong> :{' '}
          <ToComplete value={LEGAL_ENTITY.contactEmail} label="e-mail de contact" />.
          Nous répondons sous 30 jours au plus.
        </li>
        <li>
          <strong>Réclamation</strong> : tu peux saisir la CNIL —{' '}
          <a href="https://www.cnil.fr/fr/plaintes" target="_blank" rel="noreferrer noopener">
            cnil.fr/fr/plaintes
          </a>
          .
        </li>
      </ul>

      <h2>9. Sécurité</h2>
      <p>
        Les échanges sont chiffrés en transit (HTTPS). L’accès à la base de données
        est protégé par des politiques de sécurité au niveau des lignes, et le
        stockage des images n’est pas public. Les clés secrètes ne sont jamais
        exposées côté navigateur.
      </p>

      <h2>10. Modifications</h2>
      <p>
        Cette politique peut évoluer. La date de dernière mise à jour figure en
        haut de page. Toute modification substantielle sera signalée dans le
        service.
      </p>
    </>
  );
}

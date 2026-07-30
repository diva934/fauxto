import type { Metadata } from 'next';
import { ToComplete } from '@/components/legal/ToComplete';
import { LAST_UPDATED, LEGAL_ENTITY } from '@/lib/legal';
import { PACKS } from '@/lib/packs';
import { BRAND, formatPrice } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Conditions générales de vente',
  description: `Conditions de vente des crédits ${BRAND.name}.`,
  robots: { index: true, follow: true },
};

export default function CgvPage() {
  return (
    <>
      <h1>Conditions générales de vente</h1>
      <p className="!text-sm">Dernière mise à jour : {LAST_UPDATED}</p>

      <h2>1. Vendeur</h2>
      <p>
        <ToComplete value={LEGAL_ENTITY.companyName} label="raison sociale" />,{' '}
        <ToComplete value={LEGAL_ENTITY.address} label="adresse du siège" />, SIRET{' '}
        <ToComplete value={LEGAL_ENTITY.siret} label="numéro SIRET" />. Contact :{' '}
        <ToComplete value={LEGAL_ENTITY.contactEmail} label="e-mail de contact" />
      </p>

      <h2>2. Objet</h2>
      <p>
        Les présentes conditions régissent la vente de <strong>crédits</strong>
        permettant de générer des images sur {BRAND.domain}. Un crédit correspond à
        une génération d’image réussie.
      </p>

      <h2>3. Prix et packs</h2>
      <p>
        Les prix sont indiqués en euros, toutes taxes comprises. Il s’agit
        d’<strong>achats uniques</strong> : {BRAND.name} ne propose aucun
        abonnement, aucun prélèvement récurrent, aucune reconduction automatique.
      </p>
      <table>
        <thead>
          <tr>
            <th>Pack</th>
            <th>Crédits</th>
            <th>Prix TTC</th>
          </tr>
        </thead>
        <tbody>
          {PACKS.map((pack) => (
            <tr key={pack.id}>
              <td>
                <strong>{pack.labelFr}</strong>
                {pack.badgeFr ? ` — ${pack.badgeFr}` : ''}
              </td>
              <td>{pack.credits}</td>
              <td>{formatPrice(pack.priceEuros)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>4. Les crédits n’expirent pas</h2>
      <p>
        Les crédits achetés <strong>n’ont aucune date de péremption</strong>. Ils
        restent utilisables aussi longtemps que ton compte existe et que le service
        est en activité. Ils ne sont ni cessibles, ni échangeables contre de
        l’argent.
      </p>

      <h2>5. Première génération offerte</h2>
      <p>
        Une génération est offerte, sans création de compte. L’image produite porte
        un filigrane comportant le nom de domaine. Ce filigrane commercial n’est
        plus appliqué sur les images générées avec des crédits achetés.
      </p>
      <p>
        En revanche, la mention légale «&nbsp;Image générée par IA&nbsp;» et les
        métadonnées de provenance sont présentes sur{' '}
        <strong>toutes les images sans exception</strong>, y compris payantes :
        elles répondent à une obligation réglementaire et ne constituent pas une
        option commerciale.
      </p>

      <h2>6. Commande et paiement</h2>
      <p>
        Le paiement s’effectue par carte bancaire via Stripe. Aucune donnée
        bancaire ne transite par nos serveurs ni n’y est conservée. Un compte est
        créé à ton nom au moment du paiement, et un lien de connexion t’est envoyé
        par e-mail. La commande est ferme dès l’encaissement.
      </p>

      <h2>7. Génération échouée : aucun crédit débité</h2>
      <p>
        Si une génération échoue — panne, dépassement du délai, refus du modèle —
        le crédit réservé <strong>t’est intégralement rendu</strong>, automatiquement
        et immédiatement. Tu ne paies jamais un échec.
      </p>
      <p>
        Un refus de modération (photo de personne mineure, contenu interdit) n’est
        pas un échec technique mais un refus de service : le crédit est également
        rendu.
      </p>

      <h2>8. Droit de rétractation</h2>
      <p>
        Conformément aux articles L221-18 et suivants du code de la consommation,
        tu disposes d’un délai de 14 jours pour te rétracter.
      </p>
      <p>
        <strong>Attention</strong> : il s’agit d’un contenu numérique fourni
        immédiatement. En validant ton achat, tu demandes expressément l’exécution
        immédiate et tu reconnais perdre ton droit de rétractation{' '}
        <strong>sur les crédits déjà consommés</strong>, en application de
        l’article L221-28, 13°.
      </p>
      <p>
        Les <strong>crédits non consommés restent remboursables</strong> pendant
        14 jours à compter de l’achat. Écris-nous à{' '}
        <ToComplete value={LEGAL_ENTITY.contactEmail} label="e-mail de contact" />
        {' '}: le remboursement est effectué au prorata des crédits inutilisés, dans
        un délai de 14 jours, sur le moyen de paiement d’origine.
      </p>

      <h2>9. Résultat de la génération</h2>
      <p>
        Le service repose sur un modèle d’intelligence artificielle génératif. Le
        rendu est par nature variable et ne peut être garanti conforme à une
        attente précise. Un résultat techniquement abouti mais esthétiquement
        décevant ne constitue pas un défaut ouvrant droit à remboursement — un
        crédit consommé pour une image effectivement produite est un crédit dû.
      </p>

      <h2>10. Suppression des images sous 24 heures</h2>
      <p>
        Les images produites sont supprimées de nos serveurs au plus tard
        24&nbsp;heures après leur création. Il t’appartient de télécharger celles
        que tu souhaites conserver. Aucune restauration n’est possible après
        suppression.
      </p>

      <h2>11. Suspension du compte</h2>
      <p>
        En cas d’usage manifestement abusif — tentative de contournement des
        filtres, envoi répété de photographies de personnes mineures, usage
        malveillant caractérisé — le compte peut être suspendu sans remboursement
        des crédits restants.
      </p>

      <h2>12. Médiation et litiges</h2>
      <p>
        En cas de différend, contacte-nous d’abord : la majorité des situations se
        règle en un échange. À défaut, tu peux recourir gratuitement à un médiateur
        de la consommation. Le droit français est applicable.
      </p>
    </>
  );
}

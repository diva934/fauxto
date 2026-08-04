import { ChevronDown } from 'lucide-react';
import Link from 'next/link';

/**
 * FAQ en accordéon.
 *
 * Construite sur `<details>`/`<summary>` natifs : aucun JavaScript, aucune
 * hydratation, navigation clavier et lecteur d'écran corrects par défaut. Sur un
 * produit dont 95 % du trafic vient de TikTok sur mobile, économiser du JS sur
 * une section basse de page est un gain net.
 *
 * La question sur la légalité n'est pas là pour rassurer à peu de frais : c'est
 * la première objection réelle sur ce type de produit, et Fauxto peut y répondre
 * concrètement puisque la conformité est effectivement implémentée.
 */

const ITEMS = [
  {
    q: 'Le rendu est-il crédible ?',
    a: (
      <>
        Sur les scénarios proposés, oui — c’est justement pour ça qu’ils sont
        limités à dix. Chaque prank a été calibré pour tenir la route. En
        revanche, chaque image porte un marquage de provenance invisible à
        l’œil mais lisible à l’analyse : elle est crédible sur le moment, pas
        indétectable, et c’est volontaire.
      </>
    ),
  },
  {
    q: 'Est-ce légal ?',
    a: (
      <>
        Oui, dans le cadre prévu. Fauxto applique le règlement européen sur l’IA
        (article 50) : métadonnées de provenance C2PA et marquage
        machine-lisible sur chaque image. En revanche, rien n’est écrit sur
        l’image&nbsp;: prévenir la personne que la photo est générée, au moment
        de l’envoyer, c’est à toi de le faire. Le service refuse automatiquement les
        photos de personnes mineures, les contenus à caractère sexuel, les
        personnalités publiques et les scènes évoquant la maladie, la violence ou
        un décès.
        <br />
        <br />
        Ce qui reste ta responsabilité : n’envoyer que des photos dont tu as le
        droit de disposer, et ne pas t’en servir pour nuire à quelqu’un. Diffuser
        une image modifiée en la présentant comme authentique peut constituer une
        infraction — le côté humoristique n’y change rien. Les détails sont dans
        les <Link href="/cgu">CGU</Link>.
      </>
    ),
  },
  {
    q: 'Que devient la photo que j’envoie ?',
    a: (
      <>
        Elle est transmise à Google pour être traitée par l’API Gemini, puis
        supprimée. L’image produite est effacée de nos serveurs au plus tard
        24&nbsp;heures après sa création, par une tâche automatique qui tourne
        toutes les heures. Aucune photo ne sert à entraîner un modèle, et aucune
        adresse IP n’est stockée en clair. Tout est détaillé dans la{' '}
        <Link href="/confidentialite">politique de confidentialité</Link>.
      </>
    ),
  },
  {
    q: 'Combien ça coûte ?',
    a: (
      <>
        <strong>1 € la photo à l’unité.</strong> Ensuite c’est dégressif :
        5 pranks à 3,99 €, 15 à 8,99 € (0,60 € l’unité), 40 à 19,99 €
        (0,50 € l’unité). Tu paies juste avant de générer, une fois ta photo
        choisie — et elle est conservée pendant la transaction, tu ne
        recommences rien.
      </>
    ),
  },
  {
    q: 'Faut-il créer un compte ?',
    a: (
      <>
        Oui. Il se crée avec ton e-mail, sans mot de passe : tu reçois un lien,
        tu cliques, c’est fait. Le compte sert à conserver tes crédits d’un
        appareil à l’autre — sans lui, tes crédits seraient perdus dès que tu
        changes de téléphone.
      </>
    ),
  },
  {
    q: 'C’est un abonnement ?',
    a: (
      <>
        Non, et ça ne le deviendra pas. Ce sont des crédits en paiement unique.
        Aucun prélèvement récurrent, aucune reconduction. Les crédits{' '}
        <strong>n’expirent jamais</strong> : personne ne piège ses potes chaque
        semaine, ce serait absurde de te faire payer un mois vide.
      </>
    ),
  },
  {
    q: 'Et si la génération rate ?',
    a: (
      <>
        Ton crédit t’est rendu automatiquement, immédiatement. C’est vrai pour une
        panne, un dépassement de délai comme pour un refus de modération. Tu ne
        paies jamais un échec.
      </>
    ),
  },
  {
    q: 'Ça marche sur téléphone ?',
    a: (
      <>
        Le site est conçu pour le mobile d’abord — le desktop est l’adaptation,
        pas l’inverse. Tu peux aussi l’ajouter à ton écran d’accueil et
        l’utiliser comme une vraie application, en plein écran et sans barre
        d’adresse.
      </>
    ),
  },
  {
    q: 'Quelqu’un apparaît sur une image et n’est pas d’accord',
    a: (
      <>
        La page <Link href="/signaler">Signaler une image</Link> existe pour ça,
        et ces demandes passent en priorité. Compte tenu de la suppression
        automatique sous 24&nbsp;heures, l’image aura le plus souvent déjà
        disparu de nos serveurs — on répond quand même, et on bloque ce qui peut
        l’être.
      </>
    ),
  },
] as const;

export function Faq() {
  return (
    <section className="px-5 py-12" aria-labelledby="faq">
      <p className="text-center text-[11px] font-bold tracking-[0.2em] text-accent-strong">
        QUESTIONS FRÉQUENTES
      </p>
      <h2
        id="faq"
        className="mt-2 text-center text-3xl font-extrabold leading-tight tracking-tight text-balance"
      >
        Ce qu’on te doit avant que tu paies
      </h2>

      <div className="mt-8 space-y-2">
        {ITEMS.map((item) => (
          <details
            key={item.q}
            className="group rounded-card border border-line bg-surface open:border-accent/40"
          >
            <summary className="flex min-h-touch cursor-pointer list-none items-center justify-between gap-3 p-4 text-[15px] font-semibold [&::-webkit-details-marker]:hidden">
              {item.q}
              <ChevronDown
                aria-hidden
                className="size-5 shrink-0 text-muted transition-transform group-open:rotate-180"
              />
            </summary>
            <div className="px-4 pb-4 text-[15px] leading-relaxed text-muted [&_a]:text-accent-strong [&_a]:underline [&_strong]:text-text">
              {item.a}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

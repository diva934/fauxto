# Sécurité

## Signaler une faille

Écrivez à l'adresse de contact publiée sur les [mentions légales](https://fauxto.online/mentions-legales).
Merci de ne pas ouvrir d'issue publique pour une faille exploitable.

Décrivez ce que vous avez trouvé, comment le reproduire, et ce que ça permet
d'obtenir. Une réponse est envoyée sous 72 heures.

Pour signaler une **image** plutôt qu'une faille — une photo de vous, un contenu
qui n'aurait pas dû passer la modération — la page [/signaler](https://fauxto.online/signaler)
est le bon chemin : elle écrit dans une table dédiée et déclenche un traitement.

## Ce qui est considéré comme une faille

- Accès aux images ou aux données d'un autre compte.
- Génération sans crédit, ou crédit obtenu sans paiement.
- Contournement de la modération sur les catégories refusées (mineurs, contenu
  sexuel, personnalités publiques, maladie, violence, décès).
- Attribution de commissions partenaire non méritées.
- Lecture des chiffres d'un partenaire par un tiers.
- Retrait du marquage de provenance côté serveur.

## Ce qui n'en est pas

- Le fait qu'une image générée soit crédible : c'est l'objet du produit.
- L'absence de mention visible sur l'image. C'est un choix documenté ; le
  marquage machine (C2PA, IPTC, SynthID) reste apposé, et l'obligation
  d'informer le destinataire incombe à l'utilisateur qui partage.
- Un rapport issu d'un scanner automatique, sans preuve d'exploitabilité.

## Principes appliqués dans le code

Ils sont vérifiables, pas déclaratifs — chacun correspond à un mécanisme précis.

**Aucune adresse IP en clair.** Les empreintes anti-abus sont des HMAC-SHA256
salés (`FINGERPRINT_SALT`), tronqués. Voir `lib/anon-session.ts`. Sans le sel,
la route de génération refuse de servir plutôt que de se dégrader en silence.

**Le solde de crédits n'est modifiable que par des fonctions Postgres
`security definer`**, jamais depuis le client. Les fonctions sensibles sont
révoquées pour `anon` et `authenticated`, et accordées au seul `service_role`.

**L'idempotence repose sur la base, pas sur le code.** `credit_transactions.stripe_session_id`
et `partner_conversions.stripe_session_id` sont `UNIQUE` : un rejeu du webhook
Stripe viole la contrainte, la transaction est annulée, et rien n'est crédité
ni attribué deux fois.

**L'identité vient toujours de la session serveur.** Ni le compte à créditer,
ni le code partenaire ne sont lus depuis le corps d'une requête. Une version
antérieure retrouvait le compte par e-mail au moment du paiement : on pouvait
créditer un tiers. C'est fermé.

**RLS activé sur toutes les tables.** Les tables qui n'ont aucune policy
(`anon_sessions`, `reports`, `partner_clicks`) sont donc totalement
inaccessibles aux clés publiques — c'est voulu, pas un oubli.

**Modération fail-closed.** Si l'analyse de la photo source échoue, la
génération est refusée. Une modération qui laisse passer en cas de panne ne
protège de rien.

**Purge sous 24 heures.** Les images générées sont supprimées du stockage par
une tâche planifiée. La colonne `purge_after` porte l'échéance.

## Périmètre

Le dépôt ne contient aucun secret. Les variables d'environnement requises sont
listées dans `.env.example`, et `pnpm diagnose` vérifie leur présence ainsi que
la cohérence de la configuration (modèles déclarés contre modèles réellement
disponibles, tables et fonctions attendues, mode des clés Stripe).

# Mise en service de Fauxto

> Document destiné à être exécuté tel quel, par un agent ou à la main.
> Dépôt : https://github.com/diva934/fauxto — Déploiement : https://fauxto.vercel.app
>
> **Règle de sécurité à respecter du début à la fin : aucune clé secrète ne doit
> être collée dans une conversation, un fichier commité, ou un ticket.** Toutes
> les valeurs vont soit dans `.env.local` (jamais commité, déjà dans
> `.gitignore`), soit dans Vercel → Settings → Environment Variables.

---

## État actuel

Le code est complet et le build passe. Ce qui manque est **entièrement de la
configuration** — aucune fonctionnalité n'est à écrire pour que la génération
d'images fonctionne.

Commande de référence, à relancer après chaque étape :

```bash
pnpm diagnose
```

Elle liste ce qui manque, classé par gravité (🔴 bloquant / 🟠 dégradé /
⚪ optionnel), et **vérifie les identifiants de modèle Gemini contre l'API
réelle** — c'est le contrôle le plus important de tout ce document.

Verdict au moment d'écrire ces lignes : **2 bloquants**.

---

## Étape 1 — Clé Gemini (🔴 bloquant)

Sans elle, le produit ne fait rien du tout.

1. Aller sur https://aistudio.google.com/apikey
2. Créer une clé API sur un projet Google Cloud
3. Vérifier que la facturation est active sur ce projet : les modèles d'image ne
   sont pas dans le quota gratuit
4. Renseigner `GEMINI_API_KEY` dans `.env.local` **et** dans Vercel

---

## Étape 2 — Sel anti-abus (🔴 bloquant)

`/api/generate` renvoie une erreur 500 sans cette variable. Elle permet
d'identifier un visiteur sans jamais stocker son adresse IP.

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Renseigner `FINGERPRINT_SALT` dans `.env.local` et dans Vercel.

> ⚠️ Une fois en production, **ne plus jamais changer cette valeur** : la
> modifier réinitialise tous les quotas de génération gratuite déjà consommés,
> et rouvre donc la gratuité à tout le monde.

---

## Étape 3 — Vérifier les identifiants de modèle (le risque n°1)

> **Vérifié le 30/07/2026** contre le catalogue officiel
> (https://ai.google.dev/gemini-api/docs/models). Résultat : deux identifiants
> sur trois étaient bons, **le troisième n'existait pas**.
>
> | Identifiant | Rôle | Verdict |
> |---|---|---|
> | `gemini-3.1-flash-image` | 8 templates sur 10 | ✅ valide — stable, « Nano Banana 2 » |
> | `gemini-3-pro-image` | chèque géant, une de magazine | ✅ valide — stable, « Nano Banana Pro » |
> | ~~`gemini-3.1-flash`~~ | modération | ❌ **inexistant** → corrigé en `gemini-3.6-flash` |
>
> La famille 3.1 ne contient que `gemini-3.1-flash-lite`, `-flash-image`,
> `-flash-lite-image`, `-flash-live-preview` et `-flash-tts-preview`. Il n'y a
> pas de `gemini-3.1-flash` tout court.
>
> **Conséquence évitée :** la modération étant fail-closed, un identifiant
> introuvable faisait refuser **100 % des générations**, y compris avec une clé
> valide et la facturation active — et sans rien qui pointe vers la cause.
>
> Le défaut est maintenant `gemini-3.6-flash` dans
> `lib/image-engine/gemini-moderation.ts` et dans `scripts/doctor.ts`. Aucune
> variable d'environnement n'est nécessaire ; `GEMINI_MODERATION_MODEL` reste
> disponible pour basculer sur `gemini-3.5-flash-lite` (5× moins cher en entrée)
> une fois le taux de faux refus mesuré.
>
> **Rupture d'API liée, corrigée en même temps :** `temperature`, `top_p` et
> `top_k` sont dépréciés depuis Gemini 3.6 Flash — ignorés aujourd'hui,
> **erreur 400 sur les prochaines générations de modèles**. Le `temperature: 0`
> de la modération donnait donc un faux déterminisme sur une décision à
> conséquences juridiques ; il est remplacé par une `systemInstruction`
> explicite.

Le contrôle reste utile pour confirmer l'accès réel de ta clé aux trois
modèles :

Dès que la clé est en place :

```bash
pnpm diagnose
```

Le diagnostic liste les modèles réellement disponibles et, pour chaque
identifiant introuvable, propose les candidats les plus proches.

**Si un identifiant est faux :**
- pour le modèle de modération → renseigner `GEMINI_MODERATION_MODEL`, aucun
  déploiement nécessaire ;
- pour les deux modèles d'image → corriger `DEFAULT_MODEL` / `PRO_MODEL` dans
  `lib/image-engine/gemini.ts`. C'est le **seul** fichier à toucher : tous les
  appels au SDK y sont confinés par construction.

Ensuite, tester réellement la qualité sur une photo :

```bash
pnpm test:templates ./une-photo.jpg
```

Le script exécute les 10 prompts, mesure la latence, et signale si le pire cas
dépasse les 12 secondes annoncées à l'utilisateur.

---

## Étape 4 — Supabase (🟠 fortement recommandé)

Sans base, le produit fonctionne mais :
- le quota « une photo offerte » ne survit pas à un redémarrage d'instance —
  donc **le paywall est contournable** ;
- aucune purge à 24 h n'est possible, alors que les pages légales la promettent ;
- les signalements ne sont pas persistés.

1. Créer un projet sur https://supabase.com — **choisir une région européenne**
   (la politique de confidentialité l'annonce)
2. SQL Editor → coller **l'intégralité** de `supabase/migrations/0001_init.sql` →
   exécuter. Le script est idempotent, il peut être relancé sans risque.
3. Project Settings → API → récupérer les trois valeurs :
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` ⚠️ contourne la RLS, ne doit jamais atteindre
     le navigateur ni un commit
4. Authentication → URL Configuration → ajouter en Redirect URL :
   `https://fauxto.vercel.app/auth/callback`
5. Relancer `pnpm diagnose` : il vérifie que les 5 tables, la fonction
   `weekly_generation_count()` et le bucket `generations` existent réellement.
   Une clé valide sur un projet vide donnerait sinon un faux sentiment de
   sécurité.

---

## Étape 5 — Purge horaire (🟠 incohérence à régler)

**Problème factuel :** le plan Vercel Hobby limite les crons à un passage par
jour. `vercel.json` est donc réglé sur `0 3 * * *`. Or `purge_after` vaut
`created_at + 24 h` : une image créée à 4 h du matin n'est pas expirée au passage
de 3 h le lendemain, elle attend celui du surlendemain. **La conservation réelle
atteint ~48 h, alors que `/confidentialite` et `/cgv` promettent 24 h.**

Le site dit donc actuellement le contraire de ce qu'il fait. Trois issues :

**a) GitHub Actions (gratuit, recommandé).** Le workflow est déjà écrit dans
`.github/workflows/purge.yml`. Il suffit d'ajouter deux secrets dans
GitHub → Settings → Secrets and variables → Actions :
- `PURGE_URL` = `https://fauxto.vercel.app/api/cron/purge`
- `CRON_SECRET` = la même valeur que dans Vercel

**b) Vercel Pro.** Remettre `"schedule": "0 * * * *"` dans `vercel.json` et
supprimer le workflow GitHub.

**c) Corriger la promesse.** Remplacer « 24 heures » par « 48 heures » partout
dans `app/(legal)/confidentialite/page.tsx`, `app/(legal)/cgv/page.tsx`,
`app/(legal)/signaler/page.tsx`, `app/page.tsx` et `components/marketing/Faq.tsx`.
Moins bon commercialement, mais parfaitement légitime.

Générer aussi `CRON_SECRET` :

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Étape 6 — Stripe (⚪ nécessaire seulement pour encaisser)

Le produit est utilisable sans, en mode « une photo offerte ».

1. Compte sur https://stripe.com, **rester en mode test** au début
2. Developers → API keys → `STRIPE_SECRET_KEY` et
   `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
3. Developers → Webhooks → Add endpoint :
   - URL : `https://fauxto.vercel.app/api/webhooks/stripe`
   - Événement : `checkout.session.completed` (celui-là uniquement)
   - Récupérer le signing secret → `STRIPE_WEBHOOK_SECRET`

> ⚠️ Sans `STRIPE_WEBHOOK_SECRET`, un paiement aboutit **mais ne crédite rien**.
> C'est le pire scénario possible : le client est débité et n'a pas son produit.

**Test obligatoire avant de passer en mode réel** — rejouer le webhook deux fois
et vérifier qu'un seul crédit est accordé :

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
stripe trigger checkout.session.completed
```

L'idempotence repose sur la contrainte `UNIQUE` de
`credit_transactions.stripe_session_id` : le second passage lève une violation
d'unicité, la fonction Postgres l'attrape et renvoie `false` sans rien modifier.
C'est la base de données qui garantit l'unicité, pas le code — mais **il faut le
vérifier pour de vrai**, c'est un critère d'acceptation explicite.

---

## Étape 7 — Identité légale (obligatoire avant le premier euro)

Ces valeurs **ne peuvent pas être inventées** : un SIRET ou une adresse fictifs
sur des mentions légales constituent une fausse déclaration. Tant qu'elles sont
vides, les pages légales affichent `[À COMPLÉTER]` en rouge vif — c'est
volontaire, pour qu'aucun oubli ne passe en production sans se voir.

```
NEXT_PUBLIC_LEGAL_COMPANY_NAME
NEXT_PUBLIC_LEGAL_FORM
NEXT_PUBLIC_LEGAL_ADDRESS
NEXT_PUBLIC_LEGAL_SIRET
NEXT_PUBLIC_LEGAL_VAT
NEXT_PUBLIC_LEGAL_PUBLISHER
NEXT_PUBLIC_CONTACT_EMAIL
```

`NEXT_PUBLIC_CONTACT_EMAIL` doit être une **adresse réellement surveillée** :
c'est celle par laquelle arrivent les demandes de retrait d'image, et l'article
50 de l'AI Act comme le RGPD imposent d'y répondre.

---

## Étape 8 — Certificat C2PA (production)

Sans `C2PA_CERT_PEM` / `C2PA_PRIVATE_KEY_PEM`, les images sont signées avec le
certificat de **test** livré par `c2pa-node`. Le manifeste est structurellement
valide et relisible, mais marqué **non approuvé** par les vérificateurs.
Acceptable en développement, pas en production.

Un certificat C2PA s'obtient auprès d'une autorité reconnue par la Content
Authenticity Initiative. En attendant, la conformité n'est pas nulle pour autant :
la mention visible « Image générée par IA » et le marquage SynthID restent
présents sur chaque image, et `generations.c2pa_signer` trace ligne par ligne
quel signataire a servi.

---

## Vérifications finales

Dans cet ordre :

```bash
pnpm diagnose        # doit afficher « Aucun bloquant »
pnpm typecheck       # doit être silencieux
pnpm build           # doit passer sans erreur ni warning
pnpm test:pipeline   # 15 contrôles de conformité, sans clé API
pnpm test:templates ./photo.jpg   # les 10 prompts, en vrai
```

Puis à la main, sur le site déployé :

- [ ] Une génération complète aboutit en moins de 30 secondes
- [ ] La deuxième tentative déclenche le paywall
- [ ] **Vider le `localStorage` ne débloque pas** une nouvelle génération
      gratuite (le quota est côté serveur, dans `anon_sessions`)
- [ ] L'image produite porte bien « Image générée par IA » incrustée
- [ ] Une photo d'enfant est refusée avec un message clair
- [ ] Un achat Stripe en test crédite le compte
- [ ] Rejouer le webhook deux fois ne crédite qu'une fois
- [ ] Sur iPhone/Safari, la modale d'installation apparaît après la première
      génération réussie, et jamais au chargement de la page

---

## Ce qui reste à coder (hors configuration)

Aucun de ces points n'empêche la génération de fonctionner.

| Élément | Statut |
|---|---|
| Vignette `une-magazine-apres.jpg` | 🔴 **affiche « VOGUE »** — marque déposée, à régénérer avant mise en ligne. Le prompt est déjà corrigé dans `lib/templates.ts`. |
| 10 pages SEO `/prank/[slug]` | absentes — `sitemap.xml` les référence déjà, elles renvoient donc 404 |
| Service worker / mode hors-ligne | absent — le manifeste, les icônes et les splash screens iOS sont faits |
| `README.md` | absent |
| `SECURITY.md` | absent (obligation du cahier des charges) |

---

## Notes d'architecture utiles à qui reprend le code

- **Tous** les appels au SDK Gemini sont confinés dans `lib/image-engine/`.
  Changer de fournisseur (fal.ai, Replicate) = écrire une classe qui implémente
  `ImageEngine` et changer une ligne dans `lib/image-engine/index.ts`.
- La modération est **fail-closed** : toute erreur, tout doute, toute analyse
  incomplète produit un refus. Le seuil d'âge est fixé à 25 ans estimés, pas 18,
  pour absorber la marge d'erreur du modèle dans le sens qui protège.
- Les crédits fonctionnent en **réservation puis remboursement**, pas en débit
  après coup. Le cahier des charges demandait l'inverse, mais un débit tardif
  laisse une fenêtre de ~12 s où deux requêtes parallèles génèrent deux images
  pour un seul crédit. L'intention (« l'utilisateur ne paie jamais un échec »)
  est respectée par `refund_credit()`.
- La progression de génération passe par un **flux NDJSON** sur la requête POST,
  pas par du polling : sur Vercel, une fonction serverless est gelée après sa
  réponse, donc impossible de continuer un travail en arrière-plan sans file
  d'attente dédiée.
- Le type `Database` de `lib/supabase/types.ts` doit utiliser des **alias de
  type**, jamais des `interface` : une interface ne satisfait pas
  `Record<string, unknown>`, la contrainte `GenericSchema` échoue en silence et
  **tout le schéma se résout en `never`** — sans erreur sur le type lui-même,
  seulement à l'usage. Piège coûteux, déjà payé une fois.

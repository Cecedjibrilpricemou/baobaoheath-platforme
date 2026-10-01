# KÈNÈYA — dossier de reprise

> Écrit pour qu'une personne **ou une IA** puisse reprendre ce projet sans rien deviner.
> Dernière mise à jour : **2026-09-28**, après l'addendum du chef de projet. Chaque chiffre et chaque affirmation ont été vérifiés dans le dépôt le jour même, pas recopiés d'une version antérieure.
>
> Si vous constatez un écart entre ce fichier et le code, **le code a raison** — corrigez ce fichier.

---

## 1. En un coup d'œil

**KÈNÈYA** est une plateforme de santé numérique pour la Guinée. Elle relie patients, agents de santé communautaire (ASC), agents d'accueil hospitalier, laboratoires, médecins, pharmacies et administrations sur un dossier unique.

La promesse du cahier des charges tient en une phrase : **le patient ne se déplace qu'une fois**, à l'hôpital. Analyses, consultation, ordonnance, pharmacie, paiement et livraison suivent depuis son dossier.

| | |
|---|---|
| Monorepo | npm workspaces — `apps/api`, `apps/web`, `packages/shared-types` |
| API | Node 24, Express, TypeScript, Prisma 7 / PostgreSQL 16 — 25 fichiers de routes, 30 services |
| Web | Angular 21 **standalone + signals + zoneless**, Angular Material 21, i18n maison FR/EN |
| Modèle | 41 modèles Prisma, 23 enums, 24 migrations, **12 rôles** |
| Branches | `develop` (travail) → CI verte → `main` (fast-forward) |
| Tests | **376 API** (Jest, 25 suites), **21 web** (Vitest), **5 parcours e2e** (Playwright) |
| Référence contractuelle | *Cahier des charges Kènèya v2.0* du 13/09/2026 (`EF-01…EF-13`, `ENF-01…06`), **complété par l'addendum du 2026-09-28** |

> ⚠️ **Deux documents font autorité sur le périmètre, dans cet ordre** : `docs/ADDENDUM-CDC-2026-09-28.md` (le plus récent, il **rouvre** des blocs marqués livrés), puis `docs/FEUILLE_DE_ROUTE_KENEYA.md`.
>
> ⚠️ Le `README.md` à la racine est **périmé** : il parle encore de « BaoBaoHealth » et de PrimeNG, retiré depuis. Ce fichier-ci fait foi.

---

## 2. Démarrer

### Prérequis

- **Node ≥ 24**, **npm ≥ 11** (imposés par `engines`)
- **Docker** pour PostgreSQL

### Installation

```bash
npm ci                      # à la racine : installe les trois workspaces
```

Il n'y a **qu'un seul `package-lock.json`, à la racine**. Un `npm audit` lancé depuis `apps/web` audite quand même tout le monorepo.

### Base de données

```bash
cd docker && docker compose up -d postgres     # conteneur baobao_db, port 5433
cd ../apps/api
npx prisma migrate deploy
npx prisma generate
npm run prisma:seed:demo                       # jeu « Pricemou », idempotent
```

> Le piège `prisma.config.js` **est résolu depuis le 2026-09-28**. Cet artefact de build était commité à côté du `.ts` ; Prisma 7 le préférait et **ne savait pas le lire**, ce qui faisait échouer `migrate`, `generate` et `diff` sans `--config` explicite. Il est supprimé et ignoré. Les commandes Prisma n'ont plus besoin de `--config`.

### Variables d'environnement

`apps/api/src/config/env.ts` **valide au chargement du module et appelle `process.exit(1)`** si une variable manque. Une variable oubliée ne donne donc pas une erreur au premier appel : le processus meurt au démarrage, et toute suite de tests important un service meurt avec lui.

Obligatoires :

| Variable | Format |
|---|---|
| `DATABASE_URL` | URL PostgreSQL |
| `JWT_SECRET` | ≥ 16 caractères |
| `JWT_REFRESH_SECRET` | ≥ 16 caractères |
| `DB_ENCRYPTION_KEY` | **64 caractères hexadécimaux** (32 octets) |

Optionnelles : `PORT` (3000), `NODE_ENV`, `ALLOWED_ORIGINS`, `GMAIL_USER` / `GMAIL_APP_PASSWORD`, `REDIS_URL`, `SENTRY_DSN`.

Délais du circuit laboratoire, tous surchargeables : `LABO_ESCALADE_MINUTES` (30), `LABO_RELANCE_LIBERATION_MINUTES` (720), `LABO_ESCALADE_LIBERATION_MINUTES` (2880).

### Lancer

```bash
npm run dev      # API (3000) + web (4200)
npm run api      # API seule
npm run web      # web seul
```

### Se connecter

Les comptes et mots de passe **ne sont pas dans le dépôt** (volontairement). Voir `f:\perso\BaoBaoHealth\COMPTES-KENEYA.md`, hors versionnement, vérifié contre les empreintes en base.

Le jeu **« Pricemou »** (7 comptes, un par métier, mot de passe commun) se recrée sans rien casser :

```bash
cd apps/api && npm run prisma:seed:demo
```

Trois choses à savoir, chacune a déjà fait perdre du temps :

1. **Les professionnels passent par un OTP.** Gmail n'étant pas configuré, l'API renvoie le code dans la réponse de connexion et la page l'affiche.
2. **Les patients se connectent avec leur numéro de téléphone, sans OTP** — et certains n'ont aucune adresse e-mail.
3. **Si l'API ne tourne pas**, la page de connexion affichait autrefois « identifiants incorrects ». Corrigé le 2026-09-26 : elle dit maintenant « serveur injoignable ». Si vous lisez ce message, démarrez l'API — le mot de passe n'est pas en cause.

---

## 3. Architecture

```
apps/api/src/
  config/      prisma, env (valide + exit), swagger, générés Prisma, extension de chiffrement
  routes/      25 fichiers — déclarent les chemins, les rôles et les validateurs
  controllers/ traduisent HTTP ↔ service, ne contiennent aucune règle
  services/    30 fichiers — toutes les règles métier vivent ici
  validators/  schémas Zod (api.schemas.ts)
  middlewares/ authenticate, requireRole, validateBody, audit
  realtime/    Socket.IO
  utils/       app-error, jwt, password, cache, chiffrement

apps/web/src/app/
  core/        services HTTP, gardes, intercepteurs, modèles clients
  shared/      composants transverses, i18n (fr.json / en.json), pipes, layouts
  styles/      feuilles globales — _shell, _hopital, _auth, _utilities, theme Material
  features/    admin · admin-structure · asc · auth · hopital · laboratoire
               landing · medecin · patient · pharmacien

packages/shared-types/src/index.ts   LE CONTRAT (voir ci-dessous)
```

### Le contrat partagé — le point le plus important

`packages/shared-types` contient **les types d'API partagés entre le web et l'API**. Les contrôleurs annotent leurs réponses avec ces types.

Conséquence : **changer le modèle casse la compilation de l'API là où la forme ne correspond plus**, et le build Angular là où un écran lit un champ disparu. C'est voulu. Ce filet a rattrapé plusieurs régressions silencieuses.

Après toute modification :

```bash
cd packages/shared-types && npm run build     # sinon les autres voient l'ancien type
```

**Corollaire à respecter** : quand un champ est *calculé* (`expiree`, `renouvellementsRestants`, `contientProduitReglemente`), rendez-le **obligatoire** dans le type de la fonction qui le consomme. S'il est optionnel, les appelants passeront l'enregistrement Prisma brut — où le champ n'existe pas — et la règle sera **inerte sans que rien ne le signale**. C'est arrivé.

### Où vivent les styles

Tous les composants n'ont **pas** de `styleUrl`. Plusieurs écrans — dont `patient/parcours` — tirent entièrement leurs styles des feuilles globales de `src/styles/`. Créer un `.scss` à côté d'un tel composant produit un **fichier orphelin** : la compilation reste verte et la page rend sans aucune mise en forme. Vérifiez le décorateur avant d'écrire du style.

Corollaire sur le thème sombre : dans un SCSS **de composant**, utiliser `:host-context([data-theme='dark'])` ; dans une feuille **globale**, `[data-theme='dark']` — l'attribut est porté par `<html>`, et `:host-context` n'y a pas de sens.

---

## 4. Modèle de données

40 modèles, 21 enums, 21 migrations.

- **`Utilisateur`** — 12 rôles : `PATIENT`, `ASC`, `ASC_SUPERVISOR`, `MEDECIN`, `PHARMACIEN`, `AGENT_ACCUEIL`, `TECHNICIEN_LABO`, `LIVREUR`, `ADMIN_STRUCTURE`, `ADMIN_REGIONAL`, `ADMIN_NATIONAL`, `SUPER_ADMIN`. Le rôle `BIOLOGISTE` a été supprimé le 2026-09-30 : c'est le laborantin qui valide.
- **`PatientProfile`** — dossier, QR code, géographie (`prefecture`, `commune`, `quartier`), allergies et maladies chroniques en **texte libre** (d'où la comparaison tolérante aux accents, §5).
- **`EpisodeSoins` → `DemandeAnalyse` → `Echantillon` → `ResultatAnalyse`** — le parcours hôpital → laboratoire.
- **`Consultation` → `Ordonnance` → `LigneOrdonnance`** — voir ci-dessous.
- **`Commande` + `ReponsePharmacie`** — l'appel aux pharmacies du quartier et l'attribution au premier déclarant (P6, socle livré le 2026-09-26).
- **`ParametresSysteme`** — une seule ligne, `valeurs` en JSON, défauts dans `parametres.service.ts`. **Ajouter un paramètre ne demande aucune migration.**
- **`Compteur`** — numérotation lisible et atomique (`EP-2026-000123`, `DA-`, `EC-`, `OR-`), via `numero.service.ts`.

### Ce que le modèle ne sait pas encore

Vérifié le 2026-09-28. **La géographie, le partenariat des pharmacies et le rôle `LIVREUR` existent désormais** — ils manquaient dans les versions précédentes de ce document.

| Manque | Bloque | Détail |
|---|---|---|
| ~~**`LotStock`**~~ | ~~bloc 6~~ | **Comblé le 2026-09-30.** `LotStock` et `Approvisionnement` existent, `Stock.datePeremption` a disparu, et la consommation se fait au plus proche de la péremption. La migration `20260930160000_lots_de_stock_et_approvisionnement` a reversé les 7 stocks existants en 7 lots, 2 362 unités conservées. |
| **Vente au comptoir** | bloc 7 | `Facture` est attachée à une consultation (`idConsultation @unique`). Une boîte vendue à un passant n'a aucun objet pour l'enregistrer — donc rien à totaliser dans un tableau de bord. |
| **Catégorie de produit fermée** | bloc 8 | `Medicament.categorie` est un **texte libre facultatif**. On ne fonde pas une exclusion d'assurance dessus : « cosmétique », « Cosmetique » et « cosmetiques » seraient trois catégories. Le catalogue devra en outre accepter des **articles non médicamenteux** (lait, cosmétiques). |
| **Modèle d'assurance** | bloc 8 | Ni `Assureur`, ni `ContratAssurance`, ni type de structure « assurance ». |

### L'ordonnance est un *document*, pas un médicament

Avant P3, « ordonnance » désignait un médicament prescrit : trois médicaments prescrits le même jour formaient trois objets sans lien. Il n'y avait donc rien à numéroter, rien à signer d'un geste, rien que la pharmacie puisse contrôler.

Aujourd'hui :

- **`Ordonnance`** porte le document — `numero` (`OR-AAAA-NNNNNN`), `codeVerification`, `valideJusquau`, signature, `renouvellementsAutorises` / `renouvellementsUtilises` ;
- **`LigneOrdonnance`** porte chaque médicament, et **la délivrance se fait à ce niveau** (une officine peut n'avoir qu'une partie du traitement) ;
- le statut du document **se déduit de ses lignes** (`recalculerStatut`), il ne se saisit jamais.

### Un résultat d'analyse n'est visible qu'après libération

Depuis le 2026-09-28, `DemandeAnalyse.diffuseePatientLe` **n'est jamais posé par le temps qui passe** : seul un médecin qui libère les résultats le renseigne, avec `idLiberePar` et `commentaireMedecin` (l'explication en langage clair).

Avant, un résultat sans particularité partait au patient dès la validation du laboratoire, et un résultat critique finissait par partir seul au bout de 24 h. Le cas courant n'était relu par personne ; le cas grave s'échappait avec le temps. Voir §7.

---

## 5. Règles de travail du projet

Elles ne sont pas décoratives — le code les applique.

1. **API d'abord, front ensuite, dans le même bloc.** Chaque bloc API est mergé (`develop` → CI verte → `main`), puis immédiatement branché au front avec ses écrans alignés sur le design de la landing.
2. **Aucune décision non tranchée en dur dans le code.** Les décisions `D1`–`D10` du CDC sont des **paramètres administrables** (`ParametresSysteme`) ou des référentiels importables. Exemple : `prescription.signatureObligatoire` est à `false` parce que la décision D2 n'est pas arbitrée — l'imposer bloquerait la délivrance là où il n'y a pas de médecin.
3. **SMS et paiement restent simulés**, derrière `notification.service` et `payment-provider.service`. Seul l'adaptateur changera.
4. **Chaque livraison référence ses exigences** (`EF-04-05`) dans le message de commit **et dans Swagger**.
5. **Ne jamais inventer de donnée clinique.** Le référentiel `interactions_medicaments` est volontairement **vide** : de fausses règles d'interaction dans une plateforme de santé seraient pires que pas de règles.
6. **Rien de trompeur sur la vitrine.** Les chiffres de la landing viennent de `GET /stats/public` avec repli `—`. Une fonctionnalité non construite qui figure au parcours porte une pastille « Bientôt ».
7. **Rien de médical ne parvient au patient sans qu'un soignant l'ait décidé.** Ni la validation du laboratoire, ni l'expiration d'un délai ne rendent un résultat visible. Le garde-fou qui relance le médecin escalade vers l'administrateur de la structure, **jamais vers le patient** — sinon il rétablirait par la fenêtre la diffusion automatique qu'on a supprimée.

### Comparaison de libellés saisis à la main

Les allergies et maladies chroniques sont du texte libre. `prescription-securite.service.ts` compare sur une forme normalisée (sans accents ni casse) **avec un seuil de 4 caractères** : sans ce seuil, « fer » se rapprocherait de « fermeture ». Une alerte de trop est du bruit, et le bruit apprend au prescripteur à ne plus lire les alertes.

---

## 6. Vérifier son travail

```bash
# API
cd apps/api && npx tsc --noEmit && npm test && npm run build

# Web
cd apps/web && npx tsc --noEmit && npm test
npm run build -- --configuration=production     # seul le build vérifie les templates

# Parcours e2e (démarre API + web tout seul)
docker run -d --name keneya_e2e_db \
  -e POSTGRES_USER=baobaoheath -e POSTGRES_PASSWORD=baobaoheath \
  -e POSTGRES_DB=baobaoheath_e2e -p 55433:5432 postgres:16-alpine
cd apps/web && npm run e2e
```

**`tsc --noEmit` ne vérifie pas les templates Angular.** Seul `ng build` le fait.

### Un build vert ne prouve pas qu'une page rend quelque chose

C'est la leçon la plus chère du projet, payée **trois fois** :

1. `*ngTemplateOutlet` sans importer `NgTemplateOutlet` → page vide, build vert.
2. `computed()` sur une propriété `ngModel` ordinaire → valeur figée, bandeau jamais affiché.
3. Un `.scss` créé à côté d'un composant **sans `styleUrl`** → bloc affiché sans aucune mise en forme, build vert.

**Toute question d'affichage se vérifie dans un vrai navigateur**, dans les deux thèmes. Playwright pilote le Chrome installé (`channel: 'chrome'`) ; un script jetable qui se connecte, navigue, lit `getComputedStyle` et prend une capture coûte quelques minutes et attrape ce que la compilation ne voit pas.

### CI

`.github/workflows/ci.yml` — cinq jobs sur chaque poussée : *API Build & Test*, *API Security Audit*, *Web Build*, *Web Security Audit*, *E2E Parcours*. Le job *Deploy* est **ignoré** (aucun secret ni environnement `production` configuré).

L'audit passe par **`scripts/audit-gate.mjs`**, pas par `npm audit` brut : même exigence (tout avis *high*/*critical* fait échouer la CI) mais avec des **exceptions nommées par identifiant GHSA, justifiées et datées**.

> `gh run list --commit <sha>` est **peu fiable sur ce dépôt** : il renvoie parfois un run périmé, parfois rien. Interrogez par branche et filtrez sur `headSha` :
> `gh run list --branch develop --limit 5 --json databaseId,headSha,status,conclusion`

### Les permissions se testent

`requireRole` porte ses rôles (`GardeDeRole.roles`), ce qui permet de parcourir la pile d'un routeur Express et d'affirmer qui peut atteindre quoi — voir `tests/routes-permissions.test.ts`. Avant, retirer un `requireRole` d'une route ne cassait aucun test et l'API s'ouvrait en silence.

**Fermer une route ne suffit pas toujours.** La même donnée arrive souvent par plusieurs chemins : les résultats d'analyse sont exposés par `/demandes-analyse/:id` **et** par la fiche d'épisode. Retirer le droit d'un côté le laissait revenir par l'autre. Cherchez toujours le second chemin.

### Prouver, pas supposer

La convention du projet est de **saboter ses propres tests** avant de les croire : retirer la garde, vérifier que le test tombe pour la bonne raison, restaurer. Une suite verte ne prouve rien tant qu'on ne l'a pas vue échouer.

Signe qui ne trompe pas : quand un changement de règle fait échouer des tests existants, **lisez leurs noms**. Le 2026-09-28, quatre tests sont tombés — ils s'appelaient « diffuse aussitôt au patient » et « diffuse au patient passé le délai ». Ils faisaient exactement leur travail.

---

## 7. Où nous en sommes

### Livrés sur `main` (API **et** front)

| Bloc | Objet |
|---|---|
| **P0** | Identité de la plateforme administrable (nom, logo, coordonnées) |
| **P1** | Épisode de soins, demande d'analyse, espace Accueil hôpital, « Mon parcours » patient |
| **P2** | Laboratoire complet — file, prélèvement, résultats, validation, valeurs critiques, courbes |
| **P3** | Ordonnance infalsifiable (numéro + code + validité + signature), sécurité de prescription (allergies, interactions, contre-indications), renouvellement, produits réglementés |
| **P6** | **Socle API seulement** — géographie, pharmacie partenaire, `Commande`, appel au quartier, attribution atomique. **Aucun écran.** |

Ajouts récents hors blocs :

- **2026-09-26** — écran « Orientations » côté médecin. L'accueil orientait un patient vers un médecin : l'épisode recevait bien son `idResponsable` et un rendez-vous était créé, mais **aucune notification ni aucun écran** ne le disait au médecin. L'orientation écrivait dans le vide.
- **2026-09-26** — la page de connexion ne confond plus « serveur injoignable » et « identifiants incorrects ».
- **2026-09-28** — **bloc 1 de l'addendum** : la libération des résultats par le médecin (voir ci-dessous).

### ⚠️ Trois blocs marqués « livrés » ont été rouverts

L'addendum du 2026-09-28 (`docs/ADDENDUM-CDC-2026-09-28.md`) contient neuf points du chef de projet, dont **trois contredisent du code en production**. Ne lisez pas P1 et P2 comme terminés.

| Ce qui change | Ce que faisait le code | État |
|---|---|---|
| **Le médecin fixe les RDV** | `hopital.service.ts` est le **seul** endroit du code qui crée un rendez-vous — et c'est l'agent d'accueil. Le médecin n'en crée aucun. | à faire (bloc 3) |
| **Plus de biologiste, juste laborantin** | Le rôle était exigé à **sept endroits**. La validation nominative reste bloquante : quelqu'un continue de signer. | ✅ **livré le 2026-09-30** |
| **Résultats libérés par le médecin** | Tout résultat non critique partait au patient dès la validation ; un critique partait seul au bout de 24 h. | ✅ **livré le 2026-09-28** |

Décisions prises le même jour, à ne pas rediscuter :

- **Seul le médecin crée le rendez-vous** ; l'accueil oriente sans proposer d'heure.
- **Le laborantin valide**, `BIOLOGISTE` est supprimé ; migration des comptes obligatoire, les comptes rendus déjà validés gardent le nom de leur valideur.
- **L'« assistante » est l'`AGENT_ACCUEIL` existant**, à qui on ajoute le pointage. Pas de nouveau rôle.
- **L'accueil ne fait plus rien de médical** : ni prescription d'analyses, ni envoi aux pharmacies, ni lecture de résultats. Il garde : chercher/créer le patient, **ouvrir l'épisode**, pointer la présence, rediriger. Le médecin ferme l'épisode.
- **La prise de rendez-vous à distance se fait maintenant** ; la **téléconsultation réelle** (visioconférence) reste en lot V4, suspendue à D2.

---

## 8. Ce qui reste

Deux listes qui **se recouvrent largement**. Le chef de projet n'a pas ajouté huit chantiers aux soixante restants : il en a déplacé, supprimé et précisé.

### A. Les blocs de l'addendum — 6 livrés sur 8, restent le 7 et le 8

| | Bloc | Taille | Où il tombe dans l'ancienne feuille |
|---|---|---|---|
| 1 | ✅ Résultats libérés par le médecin | M | **P2** — livré |
| 2 | ✅ Le médecin prescrit, l'accueil se recentre | M | **P2** — livré le 2026-09-29 |
| 3 | ✅ RDV fixés par le médecin + agenda + pointage | M | **P1** — livré le 2026-09-30 |
| 4 | ✅ Suppression du rôle biologiste | M | **P2** — livré le 2026-09-30 |
| 5 | ✅ Prise de rendez-vous à distance | M | **P13 → remonté** — livré le 2026-09-30 |
| 6 | ✅ Pharmacie : lots, approvisionnement, péremptions | L | **P6** — livré le 2026-09-30 |
| 7 | Pharmacie : vente et tableau de bord | M | **P6** — travail réellement neuf |
| 8 | Assurance enrichie | L | **P10** — précise, n'ajoute pas de bloc |

**L'ordre n'est pas négociable pour le bloc 2** : le seul écran permettant de prescrire une analyse est aujourd'hui celui de l'accueil. Retirer le droit avant de construire l'écran du médecin rendrait tout le bloc laboratoire inaccessible.

### B. L'ancienne feuille de route — décompte réel des cases

| Bloc | Fait | Reste |
|---|---|---|
| P0 Identité plateforme | 5 | **0** ✅ |
| P1 Épisode de soins | 7 | 4 — *rouvert* |
| P2 Laboratoire | 9 | 3 — *rouvert* |
| P3 Ordonnance | 5 | 1 |
| P4 Identité, consentement, accès | 0 | 7 |
| P5 Fil d'avancement | 0 | 3 |
| P6 Pharmacie et officine | 3 | 10 — dont l'extraction automatique de facture |
| P7 Paiement | 0 | 5 |
| P8 Livraison, carte, annuaire | 0 | 9 |
| P9 Notifications neutres | 0 | 2 |
| P10 Assurance | 0 | 9 |
| P11 Admin, audit, référentiels | 0 | 5 |
| P12 Interopérabilité | 0 | 3 |
| P13 Extension | 0 | 5 |

**Seul P0 est réellement fini.**

### C. Ce que l'addendum ne couvre pas et qu'il ne faut pas perdre

Ces blocs n'ont pas été évoqués par le chef de projet, mais ils conditionnent une mise en service :

- **P4** (7 cases) — identito-vigilance, doublons, consentement versionné, bris de glace, journal des accès patient. Le plus lourd non commencé, et le plus sensible réglementairement.
- **P11** (5 cases) — **il conditionne le reste** : il apporte l'import des référentiels. Sans lui, le référentiel d'interactions reste vide et le catalogue de médicaments ne se gère qu'en base.
- **P9** (2 cases, S) — aucun contenu médical dans un message sortant. Petit, mais c'est une exigence.

### D. Questions ouvertes

Quatre, listées en fin d'addendum. La première est **tranchée par l'usage** : le bloc 6 est livré en saisie assistée, la facture restant attachée en justificatif ; l'extraction automatique reste à décider et devra toujours passer par une relecture à l'écran. Reste bloquante pour le bloc 8 :

- Le catalogue doit-il accepter des articles non médicamenteux (lait, cosmétiques) ? Ce point conditionne les exclusions d'assurance du bloc 8.

Deux propositions de `PARCOURS-COMMANDE-LIVRAISON.md` attendent encore validation : la double voie de preuve de remise, et le circuit de substitution pharmacien → médecin.

### E. Le chemin critique n'est pas le code

L'agrément de l'hébergeur santé (ENF-05) et la reprise de données commandent la date de mise en service — ils ne s'accélèrent pas en écrivant plus vite, et sont à lancer **immédiatement, en parallèle**. Six décisions externes (D1/D2/D4/D5/D6/D7/D8) conditionnent des blocs entiers ; toutes sont déjà des paramètres, les trancher ne demandera aucun développement.

---

## 9. Dette et pièges connus

### Dette (vérifiée le 2026-09-28)

| Point | Constat |
|---|---|
| ~~`apps/api/prisma.config.js`~~ | ✅ **Résolu le 2026-09-28** — supprimé et ignoré. |
| Swagger | **2 routes pharmacien documentées sur 10** (`verifier` et `delivrer` ; manquent `scan`, `renouveler`, stocks, catalogue, agents), alors que le CDC l'exige. |
| CI | `actions/checkout@v4` et `setup-node@v4` ciblent Node 20, déprécié. `ubuntu-latest` bascule vers Ubuntu 26 le 19/10/2026. |
| `REDIS_URL` | Non configuré : limitation de débit **en mémoire**, donc inopérante à plusieurs instances. |
| Gmail | Non configuré : OTP en repli développement. Inacceptable en production. |
| `README.md` | Périmé (nom du produit, PrimeNG). |
| Semences hors typage | `apps/api/tsconfig.json` déclare `include: src/**/*` : **`prisma/seed*.ts` n'est pas type-vérifié**. Une erreur y reste invisible jusqu'à l'exécution. |
| Sync hors connexion | Ne couvre que l'ASC. Le laboratoire (EF-04-11) l'attend. |
| Images de la landing | Banques d'images génériques, **noms de fichiers trompeurs**, une avec signalétique en espagnol. Manquent : laboratoire, livraison. |
| Marque | Le bandeau latéral affiche encore « Santé Pour Tous » alors que les SMS partent sous « KENEYA ». |
| Rôle `LIVREUR` | Existe dans le modèle, **sans aucune route ni écran** : un tel compte atterrirait sur `/unauthorized`. |
| Journal d'audit | Les scans de QR sont tracés depuis le 2026-09-29 (**vérifié en base** : une ligne par scan, avec le rôle et la personne). Mais `idRessource` reste vide — le middleware ne lit que `req.params.id`, or le paramètre s'appelle `qrCode`. Le patient concerné n'est que dans `metadonnees.params`, donc non indexé. Répondre à « qui a consulté mon dossier ? » est possible mais coûteux. **EF-02-08 n'est pas couvert**, il reste en P4. |

### Pièges rencontrés — à ne pas repayer

**Base de données**

- **La quantité d'un stock est la somme de ses lots, et rien ne l'impose.** Depuis le 2026-09-30 la sortie passe par `consommerLots` : une quantité sans lot est indélivrable, alors que l'écran affiche du stock. Les deux semences l'avaient oublié, et la CI e2e l'a trouvé — pas les tests, pas le type-checking, pas la base locale, dont les lots venaient de la migration. Chaque semence vérifie maintenant l'invariant en terminant.
- Corollaire : **une base locale qui marche ne prouve rien sur une base neuve.** Ce qui marchait ici venait d'une reprise de données que personne ne rejouera.

**Angular**

- `computed()` **ne suit que des signaux**. Sur une propriété ordinaire liée par `ngModel`, la valeur est figée au premier calcul, sans aucune erreur. Utiliser un `signal()` posé explicitement.
- `*ngTemplateOutlet` sans importer `NgTemplateOutlet` est **ignoré en silence** : build vert, page vide. Même famille : `routerLink` sans `RouterLink`.
- Un `.scss` créé à côté d'un composant **qui n'a pas de `styleUrl`** est un fichier mort. Vérifier le décorateur avant d'écrire du style.
- Thème sombre : `:host-context([data-theme='dark'])` dans un SCSS de composant ; `[data-theme='dark']` dans une feuille globale. L'un ne marche pas à la place de l'autre.
- **Les jetons `--bb-danger`, `--bb-info` et `--bb-warning` ne sont pas redéfinis en sombre** — seuls leurs `-bg` et `-border` le sont. Un `--bb-info` (#1E40AF) sur `--bb-info-bg` sombre (#0A0F2D) est illisible. Rattraper localement avec une teinte claire (#60A5FA, #F87171, #FBBF24), comme le fait le tableau de bord médecin.
- `--bb-surface-1` **vaut** `--bb-surface-card` en sombre : un bandeau qui compte dessus pour se détacher devient invisible.
- Les styles Material se chargent **après** la feuille globale et gagnent à spécificité égale : doubler la classe (`&__x#{&}__x`) quand il faut l'emporter.

**Migrations**

- **Lisez le SQL avant d'appliquer une migration qui change un type.** Pour passer `RendezVous.statut` de `String` à un `enum`, `prisma migrate diff` proposait `DROP COLUMN` puis `ADD COLUMN` : les statuts auraient été effacés et les rendez-vous annulés seraient repassés à « planifié ». Il faut l'écrire à la main avec `USING`, et vérifier les valeurs avant/après.
- Un BOM UTF-8 en tête d'un `.prisma` le rend invalide (« This line is invalid »). `Set-Content -Encoding utf8` de PowerShell en ajoute un ; préférez Python ou l'outil d'écriture.

**Prisma**

- `ALTER TYPE … ADD VALUE` et l'usage de la valeur ajoutée **ne peuvent pas cohabiter dans la même transaction**. Deux fichiers de migration.
- Un champ `Json` revient en `JsonValue` : la conversion vers le type du contrat se fait **une fois**, dans un mappeur partagé.
- Dans un générique, `{...obj, champ: X}` **conserve le type d'origine** de `champ` par intersection. Il faut `Omit<T, 'champ'> & { champ: X }`.
- Une colonne nullable arrive en `null`, jamais `undefined`.
- **Prisma 7 a changé les drapeaux de `migrate diff`** : `--to-schema-datamodel` → `--to-schema`, `--from-url` → `--from-config-datasource`, et `--shadow-database-url` n'existe plus. Pour prouver qu'une migration reproduit le schéma : créer une base jetable, `migrate deploy` dessus, puis `migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` avec `DATABASE_URL` pointant sur elle. Attendu : « No difference detected », sortie 0.
- **Ne jamais ajouter d'`overrides` npm sans vérifier ce qu'il advient des paquets.** Une tentative a fait *disparaître* `deepmerge-ts` : `npm audit` est devenu vert parce que le code n'existait plus, pas parce qu'il était corrigé.

**Écriture atomique**

Le projet utilise partout le même motif pour une prise de décision concurrente — attribution d'une commande, libération de résultats : un `updateMany` dont le `where` porte la condition, et qui renvoie `count`. Deux appelants simultanés donnent un gagnant et un perdant, jamais deux gagnants.

**Outils (Windows)**

- Playwright utilise le **Chrome installé** en local (`channel: 'chrome'`), pas son Chromium.
- PowerShell re-tokenise les chaînes contenant `"` passées à un exe natif : utiliser `git commit -F fichier`. Les expressions `jq` avec `\(...)` y sont aussi cassées.
- Le démarrage des workers Vitest échoue parfois de façon **transitoire**. Relancer avant de diagnostiquer.
- `npx ng test` (pas `npx vitest run` directement) : l'invocation directe contourne le builder Angular et perd les globales, donnant un `describe is not defined` trompeur.

**Méthode**

- **Une vérification qui ne peut pas échouer ne vérifie rien.** Un contrôle du pointage cherchait `/Arriv/` dans la page — or le bouton s'appelle « Pointer l'arrivée », donc il passait quoi qu'il arrive. Comptez des éléments précis, et assurez-vous d'avoir vu le contrôle échouer.
- **Un écran qui envoie moins que ce que l'API exige échoue en silence.** L'écran de demande de rendez-vous n'envoyait que le motif ; l'API réclamait aussi un établissement, faute de structure préférée au dossier. Le build était vert, la page s'affichait, et le bouton ne faisait rien d'autre qu'un 400. Vérifiez un formulaire **contre l'API**, pas seulement à l'écran.
- **Les scripts de vérification déclenchent la limitation de débit** (429 après quelques connexions). Elle est en mémoire faute de `REDIS_URL` : redémarrer l'API la remet à zéro.
- **Ne jamais déduire le contenu d'un fichier de son nom.** `hero-patient.jpeg` est une plaquette d'ibuprofène vide ; `hero-hospital.jpeg` un portrait de médecin.
- Un mot de passe se vérifie **contre l'empreinte stockée**, pas contre le script de seed censé l'avoir posé. Mieux : en tentant réellement la connexion sur l'API.
- Une migration de données se prouve **en l'exécutant sur une base jetable**.
- Un script de seed périmé peut annoncer « 0 compte mis à jour » et sortir en code 0. Lire la sortie, pas seulement le code de retour.

---

## 10. Par où commencer

1. **`docs/ADDENDUM-CDC-2026-09-28.md`** — à lire en premier : il rouvre des blocs que la feuille de route affiche comme livrés.
2. `docs/FEUILLE_DE_ROUTE_KENEYA.md` — le plan vivant ; les blocs rouverts portent 🔁.
3. `docs/PARCOURS-COMMANDE-LIVRAISON.md` — **indispensable avant P6, P7 ou P8** ; inutile avant.
4. `docs/PARCOURS-DEMO.md` — dérouler le produit à la main en vingt minutes.
5. `packages/shared-types/src/index.ts` — le contrat ; on y comprend le domaine plus vite que dans le schéma.
6. `apps/api/prisma/schema.prisma` — le modèle, largement commenté sur les choix non évidents.
7. `apps/api/src/services/ordonnance.service.ts` et `laboratoire.service.ts` — représentatifs du style attendu : règles explicites, commentaires qui disent *pourquoi*, pas *quoi*.
8. `apps/web/e2e/parcours.spec.ts` — les cinq parcours décrivent le produit mieux qu'une spécification.

### Ce qu'on attend d'une contribution

- Le **pourquoi** en commentaire quand le choix n'est pas évident ; jamais la paraphrase du code.
- Des **tests qui mordent**, vérifiés par sabotage.
- Un **message de commit qui explique la décision**, pas la liste des fichiers touchés.
- Ce qui est **vérifié à l'écran** quand c'est une question d'affichage — un build vert ne prouve pas qu'une page rend quelque chose.
- Ce qui **reste ouvert**, dit explicitement plutôt que passé sous silence.

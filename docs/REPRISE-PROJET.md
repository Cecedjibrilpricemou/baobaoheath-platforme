# KÈNÈYA — dossier de reprise

> Écrit pour qu'une personne **ou une IA** puisse reprendre ce projet sans rien deviner.
> Dernière mise à jour : 2026-09-26 (spécification commande/livraison). Chaque affirmation ici a été vérifiée dans le dépôt, pas recopiée d'un document antérieur.
>
> Si vous constatez un écart entre ce fichier et le code, **le code a raison** — corrigez ce fichier.

---

## 1. En un coup d'œil

**KÈNÈYA** est une plateforme de santé numérique pour la Guinée. Elle relie patients, agents de santé communautaire (ASC), agents d'accueil hospitalier, laboratoires, médecins, pharmacies et administrations sur un dossier unique.

La promesse du cahier des charges tient en une phrase : **le patient ne se déplace qu'une fois**, à l'hôpital. Analyses, consultation, ordonnance, pharmacie, paiement et livraison suivent depuis son dossier.

| | |
|---|---|
| Monorepo | npm workspaces — `apps/api`, `apps/web`, `packages/shared-types` |
| API | Node 24, Express, TypeScript, Prisma 7 / PostgreSQL 16 |
| Web | Angular 21 **standalone + signals + zoneless**, Angular Material 21, i18n maison FR/EN |
| Branches | `develop` (travail) → CI verte → `main` (fast-forward) |
| Tests | 261 API (Jest), 21 web (Vitest), 5 parcours e2e (Playwright) |
| Référence contractuelle | *Cahier des charges Kènèya v2.0* du 13/09/2026 — exigences `EF-01…EF-13`, `ENF-01…06` |

> ⚠️ Le fichier `README.md` à la racine est **périmé** : il parle encore de « BaoBaoHealth » et de PrimeNG, qui a été retiré. Ce fichier-ci fait foi.

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
npx prisma migrate deploy --config prisma.config.ts
npx prisma generate --config prisma.config.ts
npm run prisma:seed                            # jeu de démonstration
```

> **Piège** : un artefact `apps/api/prisma.config.js` est **commité par erreur** à côté du `.ts`. Prisma le préfère et échoue à le lire. Passez toujours `--config prisma.config.ts` explicitement, ou supprimez l'artefact (voir §9).

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

### Lancer

```bash
npm run dev      # API (3000) + web (4200)
npm run api      # API seule
npm run web      # web seul
```

### Se connecter

Les comptes et mots de passe **ne sont pas dans le dépôt** (volontairement). Voir `f:\perso\BaoBaoHealth\COMPTES-KENEYA.md`, hors versionnement.

Pour remettre les comptes de démonstration à `baobao1234` :

```bash
cd apps/api && npx tsx prisma/reset-demo-passwords.ts
```

À savoir : **les professionnels passent par un OTP**. Gmail n'étant pas configuré, l'API renvoie le code dans la réponse de connexion et la page l'affiche. **Les patients se connectent avec leur numéro de téléphone, sans OTP.**

---

## 3. Architecture

```
apps/api/src/
  config/      prisma, env (valide + exit), swagger, générés Prisma, extension de chiffrement
  routes/      24 fichiers — déclarent les chemins, les rôles et les validateurs
  controllers/ traduisent HTTP ↔ service, ne contiennent aucune règle
  services/    29 fichiers — toutes les règles métier vivent ici
  validators/  schémas Zod (api.schemas.ts)
  middlewares/ authenticate, requireRole, validateBody, audit
  realtime/    Socket.IO
  utils/       app-error, jwt, password, cache, chiffrement

apps/web/src/app/
  core/        services HTTP, gardes, intercepteurs, modèles clients
  shared/      composants transverses, i18n (fr.json / en.json), pipes, layouts
  features/    admin · admin-structure · asc · auth · hopital · laboratoire
               landing · medecin · patient · pharmacien

packages/shared-types/src/index.ts   LE CONTRAT (voir §4)
```

### Le contrat partagé — le point le plus important

`packages/shared-types` contient **les types d'API partagés entre le web et l'API**. Les contrôleurs annotent leurs réponses avec ces types.

Conséquence : **changer le modèle casse la compilation de l'API là où la forme ne correspond plus**, et le build Angular là où un écran lit un champ disparu. C'est voulu. Ce filet a rattrapé plusieurs régressions silencieuses.

Après toute modification :

```bash
cd packages/shared-types && npm run build     # sinon les autres voient l'ancien type
```

**Corollaire à respecter** : quand un champ est *calculé* (`expiree`, `renouvellementsRestants`, `contientProduitReglemente`), rendez-le **obligatoire** dans le type de la fonction qui le consomme. S'il est optionnel, les appelants passeront l'enregistrement Prisma brut — où le champ n'existe pas — et la règle sera **inerte sans que rien ne le signale**. C'est arrivé, voir §9.

---

## 4. Modèle de données

38 modèles Prisma, 18 migrations. Les pièces centrales :

- **`Utilisateur`** — 12 rôles : `PATIENT`, `ASC`, `ASC_SUPERVISOR`, `MEDECIN`, `PHARMACIEN`, `AGENT_ACCUEIL`, `TECHNICIEN_LABO`, `BIOLOGISTE`, `ADMIN_STRUCTURE`, `ADMIN_REGIONAL`, `ADMIN_NATIONAL`, `SUPER_ADMIN`.
- **`PatientProfile`** — dossier, QR code, allergies et maladies chroniques en **texte libre** (d'où la comparaison tolérante aux accents en §5).
- **`EpisodeSoins` → `DemandeAnalyse` → `Echantillon` → `ResultatAnalyse`** — le parcours hôpital → laboratoire.
- **`Consultation` → `Ordonnance` → `LigneOrdonnance`** — voir ci-dessous.
- **`ParametresSysteme`** — une seule ligne, `valeurs` en JSON, défauts dans `parametres.service.ts`. **Ajouter un paramètre ne demande aucune migration.**
- **`Compteur`** — numérotation lisible et atomique (`EP-2026-000123`, `DA-`, `EC-`, `OR-`), via `numero.service.ts`.

**Ce que le modèle ne sait pas encore**, et qu'il faudra ajouter avant P6/P8 (constaté le 2026-09-26) :

| Manque | État |
|---|---|
| **Quartier / commune** | Le patient a `prefecture`, `sousPrefecture`, `village` ; la structure a `prefecture` et `adresse`. Aucun n'a de quartier — **la maille de tout le parcours commande/livraison**. |
| **Pharmacie partenaire** | `StructureSante` n'a qu'un `type` et un `estActive`. La convention n'existe pas. |
| **Rôle `LIVREUR`** | Absent de l'enum `Role`. |
| **Course, offre de prix, attribution** | Rien. |

### L'ordonnance est un *document*, pas un médicament

Avant P3, « ordonnance » désignait un médicament prescrit : trois médicaments prescrits le même jour formaient trois objets sans lien. Il n'y avait donc rien à numéroter, rien à signer d'un geste, rien que la pharmacie puisse contrôler.

Aujourd'hui :

- **`Ordonnance`** porte le document — `numero` (`OR-AAAA-NNNNNN`), `codeVerification`, `valideJusquau`, signature, `renouvellementsAutorises` / `renouvellementsUtilises` ;
- **`LigneOrdonnance`** porte chaque médicament, et **la délivrance se fait à ce niveau** (une officine peut n'avoir qu'une partie du traitement) ;
- le statut du document **se déduit de ses lignes** (`recalculerStatut`), il ne se saisit jamais.

---

## 5. Règles de travail du projet

Elles ne sont pas décoratives — le code les applique.

1. **API d'abord, front ensuite, dans le même bloc.** Chaque bloc API est mergé (`develop` → CI verte → `main`), puis immédiatement branché au front avec ses écrans alignés sur le design de la landing.
2. **Aucune décision non tranchée en dur dans le code.** Les décisions `D1`–`D10` du CDC sont des **paramètres administrables** (`ParametresSysteme`) ou des référentiels importables. Exemple : `prescription.signatureObligatoire` est à `false` parce que la décision D2 n'est pas arbitrée — l'imposer bloquerait la délivrance là où il n'y a pas de médecin.
3. **SMS et paiement restent simulés**, derrière `notification.service` et `payment-provider.service`. Seul l'adaptateur changera.
4. **Chaque livraison référence ses exigences** (`EF-04-05`) dans le message de commit **et dans Swagger**.
5. **Ne jamais inventer de donnée clinique.** Le référentiel `interactions_medicaments` est volontairement **vide** : de fausses règles d'interaction dans une plateforme de santé seraient pires que pas de règles.
6. **Rien de trompeur sur la vitrine.** Les chiffres de la landing viennent de `GET /stats/public` avec repli `—`. Une fonctionnalité non construite qui figure au parcours porte une pastille « Bientôt ».

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

**`tsc --noEmit` ne vérifie pas les templates Angular.** Seul `ng build` le fait. Un composant peut compiler et rendre une page vide (voir §9).

### CI

`.github/workflows/ci.yml` — cinq jobs sur chaque poussée : *API Build & Test*, *API Security Audit*, *Web Build*, *Web Security Audit*, *E2E Parcours*. Le job *Deploy* est **ignoré** (aucun secret ni environnement `production` configuré).

L'audit passe par **`scripts/audit-gate.mjs`**, pas par `npm audit` brut : même exigence (tout avis *high*/*critical* fait échouer la CI) mais avec des **exceptions nommées par identifiant GHSA, justifiées et datées**. Trois exceptions courantes concernent la CLI Prisma, sans correctif amont.

### Prouver, pas supposer

La convention du projet est de **saboter ses propres tests** avant de les croire : retirer la garde, vérifier que le test tombe pour la bonne raison, restaurer. Une suite verte ne prouve rien tant qu'on ne l'a pas vue échouer.

---

## 7. Où nous en sommes

Livrés sur `main` (API **et** front) :

| Bloc | Objet |
|---|---|
| **P0** | Identité de la plateforme administrable (nom, logo, coordonnées) |
| **P1** | Épisode de soins, demande d'analyse, espace Accueil hôpital, « Mon parcours » patient |
| **P2** | Laboratoire complet — file, prélèvement, résultats, validation biologiste, valeurs critiques, courbes |
| **P3** | Ordonnance infalsifiable (numéro + code + validité + signature), sécurité de prescription (allergies, interactions, contre-indications), renouvellement, produits réglementés |

**P3 n'est pas tout à fait fini** : il reste le **compte rendu de consultation structuré, daté, signé (EF-05-03)** — qui débloquera aussi un reliquat de P2 (*l'espace médecin n'émet pas encore de demandes d'analyse ; seul l'accueil le fait*).

---

## 8. Ce qui reste

Le détail complet, phase par phase, avec les jalons et ce qui n'est pas du code, est dans **`docs/FEUILLE_DE_ROUTE_KENEYA.md`**, section « Du point où nous en sommes à la mise en service ». En résumé :

| Phase | Contenu | Effort dev (1 personne) |
|---|---|---|
| **1 — Socle médical (V1)** | fin P3, P4 identité/consentement, P5 fil du parcours, P9 notifications, P11 audit/référentiels | ~12–18 j |
| **2 — Commerce (V2)** | P6 commande pharmacie, P7 paiement | ~7–10 j |
| **3 — Assurance & livraison (V3)** | P10 tiers payant, P8 livraison/annuaire | ~10–14 j |
| **4 — Interopérabilité** | P12 HL7, FHIR étendu, connecteurs | ~4–6 j |
| **5 — Extension (V4)** | P13 aidants, téléconsultation, rappels | ~4–6 j |

### Le parcours commande et livraison est spécifié

**`docs/PARCOURS-COMMANDE-LIVRAISON.md`** décrit le processus complet, arrêté avec le porteur du projet les 25 et 26 septembre 2026 : appel aux pharmacies du quartier dès l'ordonnance prête, attribution à la première qui déclare détenir tous les produits, choix du mode de remise par le patient, mise en concurrence des motards sur **délai et prix**, vérification du livreur par QR code, suivi du trajet, preuve de remise.

**À lire avant d'écrire une ligne de P6, P7 ou P8.** Trois conséquences déplacent le plan :

1. **P11 devient un préalable à P6.** Sans la notion de pharmacie partenaire ni les conventions assureur ↔ pharmacie, on ne sait ni qui notifier, ni comment calculer la prise en charge.
2. **P7 se simplifie** : le transport se règle de la main à la main au motard, hors facture plateforme. Le bloc paiement n'a pas à connaître la livraison.
3. **Une migration géographique précède tout le reste** : quartier et commune, sur le patient comme sur la structure.

Deux points y restent **en proposition, non validés** : la double voie de preuve de remise (déclaration du patient / scan du QR par le livreur) et le circuit de substitution pharmacien → médecin.

**Le chemin critique n'est pas le code** : l'agrément de l'hébergeur santé et la reprise de données commandent la date de mise en service. Six décisions externes (D1/D2/D4/D5/D6/D7/D8) conditionnent des blocs entiers — toutes sont déjà des paramètres, les trancher ne demandera aucun développement.

**P11 mérite une attention particulière** : il apporte l'import des référentiels. Tant qu'il n'est pas là, le référentiel d'interactions reste vide et le catalogue de médicaments ne se gère qu'en base (aucun écran d'administration).

---

## 9. Dette et pièges connus

### Dette (vérifiée le 2026-09-26)

| Point | Constat |
|---|---|
| `apps/api/prisma.config.js` | Artefact de build **commité**. Prisma le préfère au `.ts` et échoue. |
| Swagger | **2 routes pharmacien documentées sur 12**, alors que le CDC l'exige. |
| CI | `actions/checkout@v4` et `setup-node@v4` ciblent Node 20, déprécié. |
| `REDIS_URL` | Non configuré : limitation de débit **en mémoire**, donc inopérante à plusieurs instances. |
| Gmail | Non configuré : OTP en repli développement. Inacceptable en production. |
| `README.md` | Périmé (nom du produit, PrimeNG). |
| Sync hors connexion | Ne couvre que l'ASC. Le laboratoire (EF-04-11) l'attend. |
| Images de la landing | Banques d'images génériques, **noms de fichiers trompeurs**, une avec signalétique en espagnol. Manquent : laboratoire, livraison. |

### Pièges rencontrés — à ne pas repayer

Chacun a coûté du temps et a été corrigé. Ils sont typiques et reviendront.

**Angular**

- `computed()` **ne suit que des signaux**. L'utiliser sur une propriété ordinaire liée par `ngModel` donne une valeur figée au premier calcul, sans aucune erreur. Utiliser un `signal()` posé explicitement.
- `*ngTemplateOutlet` sans importer `NgTemplateOutlet` est **ignoré en silence** : le build reste vert et la page rend vide.
- `[data-theme="dark"] .x` dans un SCSS de composant devient **inatteignable** (encapsulation). Utiliser `:host-context()`.
- Les styles Material se chargent **après** la feuille globale et gagnent à spécificité égale : doubler la classe (`&__x#{&}__x`) quand il faut l'emporter.

**Prisma**

- `ALTER TYPE … ADD VALUE` et l'usage de la valeur ajoutée **ne peuvent pas cohabiter dans la même transaction**. Deux fichiers de migration.
- Un champ `Json` revient en `JsonValue` : la conversion vers le type du contrat se fait **une fois**, dans un mappeur partagé (`avecExpirationEtAlertes`).
- Dans un générique, `{...obj, champ: X}` **conserve le type d'origine** de `champ` par intersection. Il faut `Omit<T, 'champ'> & { champ: X }`.
- Une colonne nullable arrive en `null`, jamais `undefined`.

**Outils (Windows)**

- Playwright utilise le **Chrome installé** en local (`channel: 'chrome'`), pas son Chromium.
- PowerShell re-tokenise les chaînes contenant `"` passées à un exe natif : utiliser `git commit -F fichier`.
- Le démarrage des workers Vitest échoue parfois de façon **transitoire** (antivirus). Relancer avant de diagnostiquer.

**Méthode**

- **Ne jamais déduire le contenu d'un fichier de son nom.** `hero-patient.jpeg` est une plaquette d'ibuprofène vide ; `hero-hospital.jpeg` un portrait de médecin.
- Un mot de passe se vérifie **contre l'empreinte stockée**, pas contre le script de seed censé l'avoir posé.
- Une migration de données se prouve **en l'exécutant sur une base jetable**, puis avec `prisma migrate diff` qui doit rendre une migration vide.

---

## 10. Par où commencer

1. `docs/FEUILLE_DE_ROUTE_KENEYA.md` — le plan vivant, coché au fur et à mesure.
2. `docs/PARCOURS-COMMANDE-LIVRAISON.md` — **indispensable avant P6, P7 ou P8** ; inutile avant.
3. `packages/shared-types/src/index.ts` — le contrat ; on y comprend le domaine plus vite que dans le schéma.
4. `apps/api/prisma/schema.prisma` — le modèle, largement commenté sur les choix non évidents.
5. `apps/api/src/services/ordonnance.service.ts` — représentatif du style attendu : règles explicites, commentaires qui disent *pourquoi*, pas *quoi*.
6. `apps/web/e2e/parcours.spec.ts` — les cinq parcours décrivent le produit mieux qu'une spécification.

### Ce qu'on attend d'une contribution

- Le **pourquoi** en commentaire quand le choix n'est pas évident ; jamais la paraphrase du code.
- Des **tests qui mordent**, vérifiés par sabotage.
- Un **message de commit qui explique la décision**, pas la liste des fichiers touchés.
- Ce qui est **vérifié à l'écran** quand c'est une question d'affichage — un build vert ne prouve pas qu'une page rend quelque chose.
- Ce qui **reste ouvert**, dit explicitement plutôt que passé sous silence.

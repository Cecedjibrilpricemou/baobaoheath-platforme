# KÈNÈYA

Plateforme de santé numérique pour la Guinée 🇬🇳 — elle relie patients, agents de santé communautaire (ASC), agents d'accueil hospitalier, laboratoires, médecins, pharmacies et administrations sur un dossier unique, pensée pour fonctionner en zone à faible connectivité.

La promesse du cahier des charges tient en une phrase : **le patient ne se déplace qu'une fois**, à l'hôpital. Analyses, consultation, ordonnance, pharmacie, paiement et livraison suivent depuis son dossier.

> ## 👉 Pour reprendre le projet, lisez [`docs/REPRISE-PROJET.md`](docs/REPRISE-PROJET.md)
>
> C'est le dossier de reprise : architecture, modèle, pièges d'environnement, état d'avancement recompté, et par où commencer. Ce README n'en est que la porte d'entrée.
>
> ⚠️ **Travaillez sur `develop`.** La branche `main` s'arrête au 2026-09-26 et ne contient aucun des six blocs livrés depuis.
>
> ```bash
> git clone <url> && cd baobaoheath-platforme && git checkout develop
> ```

## Documents de référence, dans cet ordre

| Fichier | À quoi il sert |
|---|---|
| [`docs/REPRISE-PROJET.md`](docs/REPRISE-PROJET.md) | **Le dossier de reprise.** Commencez ici. |
| [`docs/ADDENDUM-CDC-2026-09-28.md`](docs/ADDENDUM-CDC-2026-09-28.md) | Les neuf points du chef de projet. **Il fait autorité sur le périmètre** et rouvre des blocs que la feuille de route affichait comme livrés. |
| [`docs/FEUILLE_DE_ROUTE_KENEYA.md`](docs/FEUILLE_DE_ROUTE_KENEYA.md) | Le plan vivant, case par case : **36 faites, 1 partielle, 58 restantes sur 95**. |
| [`docs/PARCOURS-DEMO.md`](docs/PARCOURS-DEMO.md) | Dérouler le produit à la main en vingt minutes. |
| [`docs/PARCOURS-COMMANDE-LIVRAISON.md`](docs/PARCOURS-COMMANDE-LIVRAISON.md) | Indispensable avant P6, P7 ou P8 ; inutile avant. |

## Pile technique

- **API** (`apps/api`) — Node 24, Express, TypeScript, Prisma 7 / PostgreSQL 16, Socket.IO. Authentification par **cookies httpOnly** + CSRF à double soumission (jamais de jeton dans le corps de la réponse).
- **Web** (`apps/web`) — Angular 21 : **standalone, signals, zoneless**. Angular Material 21. i18n maison FR/EN (`shared/i18n/{fr,en}.json`).
- **Contrat partagé** (`packages/shared-types`) — les types d'API, **annotés dans les contrôleurs**. Changer le modèle casse volontairement la compilation là où la forme ne correspond plus.
- **Base** — PostgreSQL, chiffrement applicatif des données sensibles.
- **Conteneurs** — `docker/docker-compose.yml` : `postgres`, `redis`, `api`, `web`.

> **Redis est dans le `docker-compose` mais n'est pas configuré** (`REDIS_URL` absent). La limitation de débit est donc **en mémoire** : elle ne tient pas à plusieurs instances, et redémarrer l'API remet ses compteurs à zéro. À traiter avant la mise en service.

## Structure

```
apps/
  api/            Express + Prisma — routes/ controllers/ services/ validators/ middlewares/
  web/            Angular — core/ shared/ styles/ features/ (10 espaces, 48 écrans)
packages/
  shared-types/   LE CONTRAT entre web et api
docker/           docker-compose.yml
docs/             cahier des charges, addendum, feuille de route, dossier de reprise
scripts/          audit-gate.mjs (portillon de sécurité de la CI), sauvegardes
```

Workspaces npm à la racine. **Il n'y a qu'un seul `package-lock.json`, à la racine** : un `npm audit` lancé depuis `apps/web` audite tout le monorepo.

## Rôles applicatifs — 12

`PATIENT` · `ASC` · `ASC_SUPERVISOR` · `MEDECIN` · `PHARMACIEN` · `AGENT_ACCUEIL` · `TECHNICIEN_LABO` · `LIVREUR` · `ADMIN_STRUCTURE` · `ADMIN_REGIONAL` · `ADMIN_NATIONAL` · `SUPER_ADMIN`

- Les comptes **`PATIENT`** s'inscrivent librement et se connectent **sans OTP**, au téléphone ou à l'e-mail — certains patients n'ont aucune adresse.
- Tous les autres rôles sont créés par un administrateur et passent par un **code OTP** envoyé par e-mail.
- Le rôle `BIOLOGISTE` a été **supprimé** le 2026-09-30 : c'est le laborantin (`TECHNICIEN_LABO`) qui valide les comptes rendus.
- `LIVREUR` existe dans le modèle **sans aucune route ni écran** : un tel compte atterrit sur `/unauthorized`.

## Démarrage

### Développement local

```bash
npm ci                                            # installe les trois workspaces
cd docker && docker compose up -d postgres        # conteneur baobao_db, port 5433
cd ../apps/api && npx prisma migrate deploy && npx prisma generate
npm run prisma:seed && npm run prisma:seed:demo   # jeu « Pricemou », idempotent
cd ../.. && npm run dev                           # API (3000) + web (4200)
```

`npm run api` et `npm run web` lancent chaque côté séparément. Les deux surveillent les fichiers.

⚠️ Ne faites pas tourner l'API à la fois dans Docker et via `npm run dev` : les deux écoutent sur le port 3000.

### Tout en Docker

```bash
cd docker && docker compose up -d
```

Web `:8080`, API `:3000`, Postgres `:5433`, Redis `:6379`.

## Configuration

`apps/api/src/config/env.ts` **valide au chargement du module et appelle `process.exit(1)`** si une variable manque. Une variable oubliée ne donne donc pas une erreur au premier appel : le processus meurt au démarrage, et toute suite de tests important un service meurt avec lui.

| Variable | Format | Obligatoire |
|---|---|---|
| `DATABASE_URL` | URL PostgreSQL | ✅ |
| `JWT_SECRET` | ≥ 16 caractères | ✅ |
| `JWT_REFRESH_SECRET` | ≥ 16 caractères | ✅ |
| `DB_ENCRYPTION_KEY` | **64 caractères hexadécimaux** (32 octets) | ✅ |
| `PORT`, `NODE_ENV`, `ALLOWED_ORIGINS` | — | — |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | compte Gmail + mot de passe d'application (16 caractères) | — |
| `REDIS_URL`, `SENTRY_DSN` | — | — |

`NODE_ENV` **doit rester `development`** pour tout usage local en HTTP : en `production`, les cookies d'authentification sont marqués `Secure` et le navigateur les rejette hors HTTPS.

Sans Gmail valide, et **en `development` uniquement**, le code OTP est renvoyé dans la réponse de connexion et la page l'affiche. C'est le mode de fonctionnement actuel.

## Comptes

Les mots de passe **ne sont pas dans le dépôt**, volontairement. Le jeu de démonstration « Pricemou » (7 comptes, un par métier, mot de passe commun) se recrée sans rien casser :

```bash
cd apps/api && npm run prisma:seed:demo
```

Il ne crée **aucun compte `ASC`** : cet espace n'est donc pas démontrable en l'état.

## Tests

```bash
npm test --workspace=apps/api              # 400 tests, 26 suites (Jest, Prisma mocké)
npm test --workspace=apps/web              # 21 tests (Vitest)
npm run build:web                          # seul le build vérifie les templates Angular
```

**`tsc --noEmit` ne vérifie pas les templates Angular**, et ne couvre pas `prisma/seed*.ts` (hors `include`).

### Parcours de bout en bout (Playwright)

Cinq parcours enchaînés dans un vrai navigateur, contre la vraie API et une base PostgreSQL **jetable** — jamais la base de développement. Playwright migre et sème la base, puis démarre l'API et le front lui-même.

```bash
docker exec baobao_db psql -U baobao_user -d postgres -c "CREATE DATABASE keneya_e2e;"
cd apps/web
E2E_DATABASE_URL=postgresql://baobao_user:<mdp>@127.0.0.1:5433/keneya_e2e npm run e2e
```

Deux pièges, tous deux déjà payés :

- **Le port 3000 doit être libre.** Hors CI, Playwright réutilise un serveur déjà lancé (`reuseExistingServer`) : si votre API de développement tourne, les parcours s'exécutent contre **votre base de développement**.
- **Sans `E2E_DATABASE_URL`**, la configuration pointe sur une base qui n'existe pas en local ; l'échec se présente comme « les comptes e2e n'existent pas ».

En local, le Chrome installé est utilisé ; en CI, le Chromium de Playwright. Comptes et données : `apps/api/prisma/seed-e2e.ts`. Parcours : `apps/web/e2e/parcours.spec.ts`.

## Intégration continue

`.github/workflows/ci.yml` — cinq travaux sur chaque poussée : *API Build & Test*, *API Security Audit*, *Web Build*, *Web Security Audit*, *E2E Parcours*. Le travail *Deploy* est ignoré (aucun secret ni environnement `production` configuré).

L'audit passe par **`scripts/audit-gate.mjs`**, pas par `npm audit` brut : même exigence — tout avis *high* ou *critical* fait échouer la CI — mais avec des **exceptions nommées par identifiant GHSA, justifiées et datées**. Quatre sont actives ; chacune dit pourquoi elle ne nous expose pas.

## Internationalisation

Service i18n maison (`shared/services/i18n.service.ts`), dictionnaires `shared/i18n/{fr,en}.json`, interpolation `{{param}}`. Une clé absente est rendue **telle quelle** — c'est ainsi qu'on repère un oubli à l'écran. Le sélecteur de langue est présent sur toutes les pages.

## Scripts utiles

| Commande | Description |
|---|---|
| `npm run dev` | API + web en parallèle, avec rechargement |
| `npm run api` / `npm run web` | un côté seulement |
| `npm run build:api` / `npm run build:web` | build de production |
| `npm run format` | Prettier |
| `npm run backup:db` / `npm run restore:db` | sauvegarde / restauration |
| `npm run prisma:studio --workspace=apps/api` | administration de la base |
| `node scripts/audit-gate.mjs` | portillon de sécurité, depuis `apps/api` ou `apps/web` |

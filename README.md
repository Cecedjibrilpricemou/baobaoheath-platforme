# BaoBaoHealth

Plateforme de santé numérique pour la Guinée 🇬🇳 — connecte patients, agents de santé communautaire (ASC), médecins, pharmaciens et administrateurs sur un système unique, pensé pour fonctionner même en zone à faible connectivité.

Monorepo **Web (Angular)** + **API (Node/Express)**.

## Stack technique

- **API** (`apps/api`) — Node.js, Express, TypeScript, Prisma (PostgreSQL), Redis, Socket.IO, authentification par cookies httpOnly + JWT.
- **Web** (`apps/web`) — Angular 21 (standalone components, signals, zoneless), PrimeNG, i18n maison FR/EN.
- **Base de données** — PostgreSQL, chiffrement des données sensibles.
- **Cache / jobs / rate-limit** — Redis.
- **Conteneurisation** — Docker Compose (`docker/docker-compose.yml`) : `postgres`, `redis`, `api`, `web`.

## Structure du monorepo

```
apps/
  api/     → backend Express + Prisma
  web/     → frontend Angular
packages/
  shared-types/  → types partagés entre web et api
docker/
  docker-compose.yml
```

Workspaces npm définis à la racine (`apps/api`, `apps/web`, `packages/shared-types`).

## Rôles applicatifs

`PATIENT` · `ASC` · `ASC_SUPERVISOR` · `MEDECIN` · `PHARMACIEN` · `ADMIN_STRUCTURE` · `ADMIN_REGIONAL` · `ADMIN_NATIONAL` · `SUPER_ADMIN`

- Les comptes **PATIENT** s'inscrivent librement depuis l'app et se connectent directement (téléphone ou email).
- Tous les autres rôles sont créés par un administrateur (structure ou super admin) et se connectent **avec leur email**, avec une vérification par **code OTP** envoyée par email.

## Démarrage rapide

### Option 1 — Tout en Docker

```bash
cd docker
docker compose up -d
```

Services exposés : Web `:8080`, API `:3000`, Postgres `:5433`, Redis `:6379`.

### Option 2 — Développement local (hot reload)

```bash
npm install
npm run dev        # lance API + Web en parallèle
# ou séparément :
npm run api        # apps/api  (tsx watch, port 3000)
npm run web         # apps/web  (ng serve, port 4200)
```

En local, seuls Postgres et Redis doivent tourner dans Docker (`docker compose up -d postgres redis`) — l'API et le web local se connectent dessus via les ports exposés sur `localhost`.

⚠️ Ne faites pas tourner l'API à la fois dans Docker et via `npm run dev` — les deux écoutent sur le port 3000.

## Configuration

Copier `.env.example` vers `.env` (racine, pour l'API) et renseigner au minimum :

```
DATABASE_URL, REDIS_URL, JWT_SECRET, DB_ENCRYPTION_KEY, ALLOWED_ORIGINS
```

`NODE_ENV` **doit rester `development`** pour tout usage local en HTTP : en `production`, les cookies d'authentification sont marqués `Secure` et sont rejetés par le navigateur hors HTTPS.

Pour l'envoi d'email (OTP de connexion, réinitialisation de mot de passe), configurer `GMAIL_USER` / `GMAIL_APP_PASSWORD`. Sans configuration valide, en mode `development` uniquement, le code OTP est affiché directement dans les logs du serveur (`[AUTH OTP DEV] Code OTP pour ... : XXXXXX`) au lieu d'être envoyé par email.

## Base de données & comptes de test

```bash
npm run prisma:migrate --workspace=apps/api
npm run prisma:seed --workspace=apps/api
```

Le seed crée uniquement un compte **SUPER_ADMIN** (voir `apps/api/prisma/seed.ts`) ; tous les autres comptes (structures, médecins, pharmaciens, agents ASC) se créent depuis l'application, une fois connecté avec ce compte.

## Internationalisation

Le frontend supporte le **français** et l'**anglais** via un service i18n maison (`shared/services/i18n.service.ts`), avec les dictionnaires dans `apps/web/src/app/shared/i18n/{fr,en}.json`. Le sélecteur de langue est disponible sur toutes les pages (accueil, authentification, et chaque espace de rôle).

## Scripts utiles

| Commande | Description |
|---|---|
| `npm run dev` | API + Web en parallèle, hot reload |
| `npm run build:api` / `npm run build:web` | Build production |
| `npm run format` | Formatage Prettier |
| `npm run backup:db` / `npm run restore:db` | Sauvegarde / restauration de la base |
| `npm run prisma:studio --workspace=apps/api` | Interface d'administration de la base |

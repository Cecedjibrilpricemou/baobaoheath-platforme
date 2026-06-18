# Analyse Backend - BaoBaoHealth

## Resume

Le backend est une API Express + TypeScript + Prisma, branchee sur PostgreSQL. La structure est claire et separee en routes, controllers, services, middlewares, types et configuration Prisma.

Le domaine metier est riche: utilisateurs, roles, patients, ASC, medecins, pharmaciens, structures de sante, consultations, ordonnances, stocks, paiements, vaccinations et notifications.

## Technologies

- Node.js et TypeScript
- Express 5
- Prisma 7 avec PostgreSQL
- JWT pour l'authentification
- bcryptjs pour les mots de passe
- Helmet et CORS pour les protections HTTP de base
- Swagger / Scalar pour la documentation API
- Redis prevu dans Docker, mais peu exploite directement dans le code lu

## Organisation

Fichiers principaux:

- `apps/api/src/index.ts`: point d'entree Express
- `apps/api/src/routes`: routes API
- `apps/api/src/controllers`: controllers HTTP
- `apps/api/src/services`: logique metier
- `apps/api/src/middlewares`: authentification et RBAC
- `apps/api/prisma/schema.prisma`: modele de donnees
- `apps/api/prisma/migrations`: migrations SQL

Les routes sont montees en `/api/v1`, par exemple:

- `/api/v1/auth`
- `/api/v1/patients`
- `/api/v1/consultations`
- `/api/v1/asc`
- `/api/v1/medecin`
- `/api/v1/pharmacien`
- `/api/v1/admin-structure`
- `/api/v1/analytics`

## Points forts

- Architecture backend lisible et modulaire.
- Separation correcte entre routes, controllers et services.
- Modele Prisma complet pour une plateforme de sante.
- Middleware JWT centralise.
- Middleware RBAC avec `requireRole`.
- Refresh tokens stockes en base via le modele `Session`.
- Utilisation de transactions Prisma pour certaines creations sensibles, par exemple creation de structure + admin.
- Gestion des roles metier cote serveur, pas seulement cote frontend.

## Points critiques

### 1. Inscription publique trop permissive

Dans `apps/api/src/services/auth.service.ts`, la fonction `register` accepte `dto.role`.

Risque: un utilisateur peut appeler directement l'API `/auth/register` et demander un role privilegie comme `ADMIN_STRUCTURE`, `MEDECIN`, `PHARMACIEN` ou meme `SUPER_ADMIN`, si aucune autre protection ne bloque cela.

Correction recommandee:

- Forcer le role `PATIENT` dans l'inscription publique.
- Creer les autres roles uniquement via des routes admin protegees.
- Refuser tout champ `role` envoye sur `/auth/register`.

Priorite: tres haute.

### 2. Build backend actuellement casse

Commande testee:

```bash
npm.cmd run build:api
```

Erreurs observees:

- `moduleResolution: "bundler"` est incompatible avec `module: "CommonJS"`.
- `apps/api/tsconfig.json` inclut `prisma.config.ts`, mais `rootDir` vaut `./src`, donc TypeScript refuse ce fichier hors `src`.

Fichiers concernes:

- `tsconfig.base.json`
- `apps/api/tsconfig.json`

Correction recommandee:

- Soit passer le backend en module moderne compatible avec `bundler`.
- Soit remplacer `moduleResolution: "bundler"` par une resolution compatible CommonJS, par exemple `node`.
- Retirer `prisma.config.ts` du build applicatif ou ajuster la config TypeScript.

Priorite: haute.

### 3. Prisma schema, migrations et client genere non synchronises

Le code utilise `doitChangerMotDePasse`. Le client Prisma genere contient ce champ, mais le `schema.prisma` visible et les migrations lues ne sont pas completement alignes.

Autre exemple: `schema.prisma` contient `TypeStructure.PHARMACIE`, mais la migration initiale de l'enum `TypeStructure` ne contient pas `PHARMACIE`.

Risques:

- Base de donnees locale ou production differente du client Prisma.
- Erreurs runtime lors d'une migration depuis zero.
- Bugs difficiles a comprendre entre environnements.

Correction recommandee:

- Mettre `schema.prisma` a jour avec tous les champs reellement utilises.
- Ajouter une migration pour `doitChangerMotDePasse`.
- Ajouter une migration pour `TypeStructure.PHARMACIE`.
- Regenerer le client Prisma apres migration.

Priorite: haute.

### 4. Validation DTO insuffisante

`zod` est installe, mais je n'ai pas trouve de validation active et systematique des `req.body`.

Risques:

- Donnees invalides envoyees aux services.
- Erreurs Prisma exposees indirectement.
- Validations inconsistantes entre routes.

Correction recommandee:

- Ajouter des schemas Zod pour login, register, creation agent, creation structure, consultation, paiement, etc.
- Ajouter un middleware de validation reutilisable.
- Retourner des erreurs 400 propres et previsibles.

Priorite: haute.

### 5. Access token pas verifie contre la session en base

Le backend verifie la signature JWT, mais l'access token semble rester valide jusqu'a expiration meme apres logout, car le middleware ne verifie pas la session en base.

Correction possible:

- Garder l'expiration courte, deja prevue.
- Verifier `sessionId` en base dans `authenticate` pour les routes sensibles.
- Ou accepter ce compromis, mais le documenter clairement.

Priorite: moyenne.

## Securite

Points positifs:

- Mots de passe hashes avec bcryptjs.
- JWT separe en access token et refresh token.
- Refresh token stocke en session.
- Helmet active.
- CORS configurable via `ALLOWED_ORIGINS`.
- RBAC present sur beaucoup de routes.

Risques principaux:

- Elevation de privilege via inscription publique.
- Absence de validation stricte des entrees.
- JWT secret charge avec `process.env.JWT_SECRET!` sans verification explicite au demarrage.
- Erreurs parfois renvoyees directement depuis les exceptions service.

## Base de donnees

Docker fournit:

- PostgreSQL 16
- Redis 7

Fichier:

- `docker/docker-compose.yml`

Le modele Prisma est ambitieux et couvre bien le domaine. Le point a corriger en priorite est l'alignement entre schema, migrations et client genere.

## Qualite de code

Points positifs:

- Services metier dedies.
- Transactions Prisma utilisees aux endroits importants.
- Types TypeScript presents.

Points a ameliorer:

- Nettoyer les commentaires avec caracteres corrompus.
- Ajouter tests unitaires et integration API.
- Centraliser les reponses d'erreur.
- Utiliser les types partages comme vraie source de contrat.

## Priorites backend

1. Bloquer les roles privilegies sur `/auth/register`.
2. Corriger le build TypeScript backend.
3. Synchroniser Prisma schema, migrations et client genere.
4. Ajouter validation Zod sur les routes principales.
5. Ajouter tests sur auth, roles, creation agent, creation structure.
6. Verifier la strategie de session apres logout.

## Verification effectuee

Commande lancee:

```bash
npm.cmd run build:api
```

Resultat: echec de build TypeScript a cause de la configuration `moduleResolution/module` et de `rootDir`.


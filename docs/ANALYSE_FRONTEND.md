# Analyse Frontend - BaoBaoHealth

## Resume

Le frontend est une application Angular moderne, organisee par roles et modules fonctionnels. Elle utilise PrimeNG pour les composants UI, Angular Router avec lazy-loading, guards d'authentification, interceptor JWT et services partages.

L'organisation est globalement saine et correspond bien a une application metier multi-roles.

## Technologies

- Angular 21
- TypeScript
- PrimeNG
- PrimeFlex
- PrimeIcons
- RxJS
- Signals Angular
- QRCode

## Organisation

Fichiers principaux:

- `apps/web/src/app/app.routes.ts`: routes principales
- `apps/web/src/app/app.config.ts`: configuration Angular
- `apps/web/src/app/core/services/api.service.ts`: client HTTP
- `apps/web/src/app/core/services/auth.service.ts`: auth frontend
- `apps/web/src/app/core/guards`: guards auth et roles
- `apps/web/src/app/core/interceptors/auth.interceptor.ts`: injection JWT et refresh
- `apps/web/src/app/features`: pages metier par role
- `apps/web/src/app/shared`: composants et services partages
- `apps/web/src/styles.scss`: design system global

## Modules fonctionnels

Routes principales:

- `/`: landing page publique
- `/auth`: login et register
- `/patient`: espace patient
- `/asc`: espace agent de sante communautaire
- `/medecin`: espace medecin
- `/pharmacien`: espace pharmacien
- `/admin-structure`: administration de structure
- `/admin`: administration globale
- `/unauthorized`: page non autorisee

## Points forts

- Architecture par roles claire.
- Lazy-loading des routes.
- Guards `authGuard` et `roleGuard`.
- Interceptor HTTP pour ajouter le token JWT.
- Refresh token automatique sur erreur 401.
- Utilisation des signals Angular dans `AuthService`.
- Composants de layout separes par role.
- Design system global dans `styles.scss`.
- PrimeNG bien integre avec theme Aura.

## Points critiques

### 1. URL API codee en dur

Dans `apps/web/src/app/core/services/api.service.ts`, l'URL API est:

```ts
private readonly baseUrl = 'http://localhost:3000/api/v1';
```

Risques:

- Probleme en production.
- Probleme si le backend tourne sur un autre port.
- Difficile d'avoir plusieurs environnements.

Correction recommandee:

- Ajouter `environment.ts` et `environment.prod.ts`.
- Lire `apiBaseUrl` depuis l'environnement Angular.

Priorite: haute.

### 2. Tokens stockes dans localStorage

Le frontend stocke `accessToken`, `refreshToken` et `currentUser` dans `localStorage`.

Risques:

- Si une faille XSS existe, les tokens sont accessibles au script malveillant.

Correction recommandee:

- Idealement passer le refresh token en cookie `HttpOnly`, `Secure`, `SameSite`.
- Garder l'access token en memoire si possible.
- Sinon, renforcer fortement la protection XSS.

Priorite: moyenne a haute.

### 3. Build frontend bloque par Google Fonts

Commande testee:

```bash
npm.cmd run build:web
```

Resultat: echec parce qu'Angular tente de recuperer Google Fonts pendant le build:

```text
Failed to inline external stylesheet 'https://fonts.googleapis.com/...'
connect EACCES
```

Ce n'est pas forcement une erreur applicative Angular. C'est surtout lie au reseau bloque dans l'environnement.

Correction recommandee:

- Installer les polices localement.
- Ou desactiver l'inlining des fonts dans la config Angular.
- Ou eviter l'import distant dans `styles.scss`.

Fichier concerne:

- `apps/web/src/styles.scss`

Priorite: moyenne.

### 4. Imports Angular inutilises

Avant l'echec du build, Angular affiche plusieurs warnings `NG8113`, par exemple:

- `TranslatePipe` importe mais non utilise
- `RouterLink` importe mais non utilise
- `ProfilModalComponent` importe mais non utilise dans certains layouts

Correction recommandee:

- Nettoyer les imports inutilises dans les composants standalone.

Priorite: basse.

### 5. Contrat frontend/backend pas totalement partage

Le frontend a ses propres types dans:

- `apps/web/src/app/core/models/user.model.ts`

Le package partage contient aussi des types dans:

- `packages/shared-types/src/index.ts`

Mais ils ne sont pas alignes. Exemple: `shared-types` definit encore `LoginDto.telephone`, alors que le frontend et le backend utilisent `identifiant`.

Correction recommandee:

- Mettre a jour `packages/shared-types`.
- Faire consommer ces types par le frontend et le backend.
- Eviter les duplications de contrats.

Priorite: moyenne.

## Authentification frontend

Flux actuel:

1. `login` appelle `/auth/login`.
2. Le backend renvoie `accessToken` et `refreshToken`.
3. Le frontend stocke les tokens.
4. Le frontend appelle `/auth/me`.
5. L'utilisateur courant est stocke dans un signal et dans `localStorage`.
6. L'interceptor ajoute `Authorization: Bearer <token>`.
7. En cas de 401, l'interceptor tente `/auth/refresh`.

Ce flux est coherent. Le principal point a ameliorer est le stockage des tokens.

## Design et UI

Points positifs:

- Design system centralise.
- Variables CSS `--bb-*`.
- Mode sombre prevu via `[data-theme="dark"]`.
- PrimeNG theme Aura configure.
- Layouts dedies par role.

Points a surveiller:

- `styles.scss` est tres gros.
- Plusieurs commentaires semblent avoir un probleme d'encodage.
- Beaucoup de styles globaux peuvent devenir difficiles a maintenir.

## Qualite de code

Points positifs:

- Composants standalone Angular.
- Services core bien identifies.
- Routes par feature.
- Guards simples et lisibles.

Points a ameliorer:

- Remplacer les `any` dans plusieurs composants et services.
- Centraliser les types API.
- Ajouter gestion d'erreur UI plus uniforme.
- Ajouter tests sur auth guard, role guard et services.
- Nettoyer les imports inutilises.

## Priorites frontend

1. Mettre l'URL API dans des fichiers d'environnement.
2. Corriger le build lie aux Google Fonts.
3. Nettoyer les warnings Angular.
4. Aligner les types frontend avec `packages/shared-types`.
5. Revoir la strategie de stockage des tokens.
6. Ajouter tests sur auth, guards et services critiques.

## Verification effectuee

Commande lancee:

```bash
npm.cmd run build:web
```

Resultat: echec a cause de l'acces reseau bloque vers Google Fonts. Des warnings Angular sur imports inutilises apparaissent avant l'echec.


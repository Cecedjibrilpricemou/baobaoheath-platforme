# Audit professionnel BaoBaoHealth - 18 juin 2026

## Synthese executive

BaoBaoHealth a nettement progresse vers une vraie plateforme sante web/API: le projet n'est plus seulement une maquette fonctionnelle, il commence a presenter une architecture backend serieuse, un modele metier riche, une separation par roles, des tests API et des modules avances comme sync offline, FHIR, consentement, USSD, triage, pharmacie et analytics.

Le niveau global est prometteur pour un MVP avance, mais il reste plusieurs points a corriger avant une mise en production ou une demonstration fiable: le build Angular est actuellement casse, l'encodage des textes francais est corrompu dans de nombreux fichiers, certains mocks front masquent encore l'integration reelle avec l'API, et quelques controles d'acces doivent etre uniformises.

Evaluation professionnelle actuelle: **7/10 pour un MVP technique**, **5.5/10 pour une version pre-production**, principalement a cause des problemes de build, d'encodage, de configuration environnementale et de durcissement securite encore incomplet.

## Verification effectuee

- Structure analysee: monorepo `apps/api`, `apps/web`, `packages/shared-types`, `docker`, `docs`.
- Tests API executes: `npm.cmd test --workspace=apps/api`.
- Verification TypeScript API executee: `npx.cmd tsc --project apps\api\tsconfig.json --noEmit`.
- Build Angular execute: `npm.cmd run build --workspace=apps/web`.
- Build API execute: `npm.cmd run build --workspace=apps/api`.

Resultats:

- API tests: **OK** - 4 suites, 18 tests passent.
- API TypeScript sans emission: **OK**.
- API build avec emission: **KO environnement/artifact** - erreurs `EPERM` en ecriture dans `apps/api/dist`.
- Web build: **KO** - JSON invalide dans `apps/web/src/app/shared/i18n/en.json:79`, puis echec d'inlining Google Fonts en environnement sans acces reseau.

## Points forts

### Architecture generale

- Le choix monorepo avec workspaces npm est pertinent: API, web et types partages peuvent evoluer ensemble.
- La structure `apps/api/src/controllers`, `services`, `routes`, `middlewares`, `validators` est lisible et proche des bonnes pratiques Express.
- Le schema Prisma est devenu riche et coherent avec le domaine sante: utilisateurs, roles, structures, patients, consultations, diagnostics, ordonnances, stocks, paiements, vaccinations, audit, consentements, sync, USSD, alertes epidemiologiques.
- La presence de migrations Prisma montre une evolution progressive du modele de donnees.

### Backend API

- Bonne base de securite HTTP: `helmet`, CORS configure via environnement, rate limiting global et specifique auth dans `apps/api/src/index.ts`.
- Validation d'environnement au demarrage dans `apps/api/src/config/env.ts`, avec `DATABASE_URL`, `JWT_SECRET`, `ALLOWED_ORIGINS`, `REDIS_URL`, etc.
- Validation Zod centralisee dans `apps/api/src/validators/api.schemas.ts`, avec beaucoup de schemas `.strict()`.
- Middleware d'erreur global propre dans `apps/api/src/middlewares/error.middleware.ts`.
- Authentification plus solide: sessions en base, refresh token, expiration, verification utilisateur actif.
- OTP pour les roles systeme et workflow reset password.
- Service `access-control.service.ts` utile pour limiter l'acces aux patients et consultations selon role et structure.
- Journal d'audit avec masquage des champs sensibles dans `apps/api/src/services/audit.service.ts`.
- Tests pertinents sur controle d'acces, triage, validations et paiement.

### Fonctionnel metier

- La plateforme couvre plusieurs parcours importants: patient, ASC, medecin, pharmacien, admin structure, admin global.
- Les modules pharmacie et ordonnances apportent de la valeur concrete: scan QR, stocks, delivrance, prix/marges.
- Les modules `sync`, `privacy`, `fhir`, `ussd`, `triage`, `stats` donnent une direction produit ambitieuse et adaptee au contexte terrain.
- Le consentement patient et l'export FHIR sont de bons signaux pour un produit de sante plus mature.

### Frontend Angular

- Angular moderne avec lazy loading par role.
- Guards d'authentification et role guard deja en place.
- Intercepteur auth avec tentative de refresh token sur 401.
- UI plus complete: layouts par role, landing, dashboards, consultations, stocks, QR code, auth OTP/reset password.
- PrimeNG, PrimeFlex, ngx-toastr et service theme/i18n donnent une base UI exploitable.

## Points faibles et risques

### P0 - Build front actuellement casse

Le fichier `apps/web/src/app/shared/i18n/en.json:79` contient une chaine non echappee:

```json
"OTP_EXPIRED_MSG": "Code expired - click "Resend code" to receive a new one."
```

Les guillemets autour de `Resend code` cassent le JSON. Tant que ce point n'est pas corrige, Angular ne peut pas produire un build.

Correction attendue:

```json
"OTP_EXPIRED_MSG": "Code expired - click \"Resend code\" to receive a new one."
```

### P0 - Encodage corrompu dans beaucoup de fichiers

De nombreux fichiers affichent des sequences de mojibake au lieu de caracteres francais lisibles, par exemple des variantes de `A+copyright`, `a+euro+dash`, `a+box-drawing`, `A+diaeresis` selon la console. Cela touche des commentaires, messages d'erreur, textes UI et donnees mockees.

Impact:

- Mauvaise experience utilisateur en francais.
- Risque de bugs dans les JSON/i18n.
- Documentation et logs moins professionnels.
- Difficulte a maintenir le code.

Priorite: convertir tous les fichiers texte en UTF-8 propre et ajouter une regle d'editeur/CI pour eviter la regression.

### P0 - Build Angular depend d'une ressource reseau Google Fonts

`apps/web/src/styles.scss:13` importe Google Fonts. Le build Angular tente d'inliner la police et echoue si l'environnement n'a pas acces a Internet.

Impact:

- Build non reproductible.
- Risque en CI/CD.
- Risque en environnement ferme ou hospitalier.

Recommandation: soit self-hoster les fonts dans `assets`, soit desactiver l'inline fonts dans la configuration Angular, soit utiliser une pile systeme robuste.

### P1 - API base URL hardcodee

`apps/web/src/app/core/services/api.service.ts:11` contient:

```ts
private readonly baseUrl = 'http://localhost:3000/api/v1';
```

Impact:

- Deploiement difficile hors local.
- Risque de rebuild obligatoire par environnement.
- Mauvaise separation configuration/code.

Recommandation: utiliser les environnements Angular ou une configuration runtime chargee au demarrage.

### P1 - Mock front actif automatiquement en dev

`MOCK_ENABLED = isDevMode()` dans `apps/web/src/app/core/interceptors/mock-data.interceptor.ts:12`.

Impact:

- En developpement, beaucoup d'appels API sont interceptes et ne testent pas le backend reel.
- Les erreurs d'integration peuvent rester invisibles jusqu'a tard.
- Les donnees mockees peuvent diverger des contrats API.

Recommandation: remplacer par un flag explicite d'environnement (`environment.mockApi`) et le mettre a `false` par defaut quand on teste l'integration.

### P1 - Controle d'acces a uniformiser dans la sync offline

Dans `apps/api/src/services/sync.service.ts`, `upsertVitalsFromSync` utilise `idConsultation` pour creer ou modifier des constantes vitales, mais ne semble pas appeler `assertCanAccessConsultation`.

Impact potentiel:

- Un utilisateur autorise a utiliser la sync pourrait tenter une mutation sur une consultation hors perimetre s'il connait son ID.

Recommandation: ajouter `assertCanAccessConsultation(user, idConsultation)` avant toute lecture/ecriture de constantes vitales, et tester ce cas.

### P1 - Gestion d'erreur non uniforme sur certaines routes

`apps/api/src/routes/admin-structure.routes.ts` contient plusieurs `try/catch (e: any)` qui renvoient directement `e.message`, au lieu de laisser le `globalErrorHandler` gerer les erreurs.

Impact:

- Reponses HTTP moins coherentes.
- Risque de fuite de messages internes.
- Duplication de logique dans les routes.

Recommandation: migrer ces handlers vers controllers/services classiques et utiliser `AppError`.

### P1 - Build API bloque par `dist`

Le build API echoue avec des erreurs `EPERM` en ecriture dans `apps/api/dist`. La verification TypeScript sans emission passe, donc ce n'est pas une erreur de typage.

Hypotheses probables:

- Dossier `dist` verrouille par un processus.
- Fichiers generes avec permissions anormales.
- Antivirus/outil Windows qui verrouille les artifacts.
- Ancien build non nettoyable.

Recommandation: ajouter un script `clean`, ignorer `dist` dans Git si ce n'est pas deja fait, et tester un build apres suppression propre du dossier.

### P2 - Beaucoup de `any` cote frontend

Le frontend contient encore beaucoup de `any` dans les services et composants. Pour un MVP cela peut passer, mais pour un produit sante c'est fragile.

Impact:

- Contrats API peu fiables.
- Refactors plus risques.
- Erreurs runtime plus probables.

Recommandation: exploiter `packages/shared-types` ou generer des types depuis OpenAPI/Zod/Prisma selon la strategie choisie.

### P2 - Documentation racine trop faible

Le `README.md` est tres minimal et presente deja un probleme d'encodage. Le projet merite un README operationnel.

Il devrait contenir:

- Prerequis Node/npm/Postgres/Redis.
- Installation.
- Configuration `.env`.
- Lancement API/web.
- Migrations/seed.
- Tests.
- Comptes demo.
- Architecture.
- URLs locales.

### P2 - Secrets et exemples d'environnement

`.env.example` contient des noms de secrets et providers utiles, mais certaines variables presentes ne semblent pas validees dans `env.ts` ou pas encore implementees.

Recommandation:

- Aligner `.env.example` avec `env.ts`.
- Documenter les variables optionnelles vs obligatoires.
- Ne jamais committer `.env` reel.

## Ameliorations prioritaires recommandees

### Priorite immediate

1. Corriger `en.json:79` pour restaurer le build Angular.
2. Corriger l'encodage UTF-8 du projet.
3. Rendre les fonts independantes du reseau ou ajuster le build Angular.
4. Remplacer `baseUrl` hardcodee par une configuration d'environnement.
5. Desactiver les mocks front par configuration explicite, pas via `isDevMode()`.

### Priorite securite

1. Ajouter `assertCanAccessConsultation` dans les mutations sync liees aux consultations.
2. Ajouter des tests de non-regression sur les mutations sync hors perimetre.
3. Uniformiser la gestion d'erreur des routes admin-structure.
4. Renforcer les mots de passe: minimum 8 ou 10 caracteres, complexite raisonnable, blocage des mots de passe faibles.
5. Ajouter une strategie de rotation/invalidations des refresh tokens plus observable.

### Priorite produit

1. Stabiliser le parcours complet login -> OTP -> dashboard par role sans mock.
2. Tester bout en bout les parcours patient, ASC, medecin, pharmacien.
3. Ajouter un mode demo controle, distinct du mode developpement.
4. Ajouter des etats vides, chargement, erreur et retry homogenes dans l'UI.
5. Ameliorer l'accessibilite: labels, focus visible, contraste, navigation clavier.

### Priorite qualite technique

1. Ajouter lint/typecheck/build/test dans une CI GitHub Actions.
2. Ajouter `npm run typecheck` pour API et web.
3. Ajouter tests frontend unitaires ou composants sur les guards, interceptors, auth et dashboards.
4. Reduire les `any` progressivement.
5. Generer ou partager les types API entre backend et frontend.

## Feuille de route courte

### Semaine 1 - Stabilisation

- Corriger build web.
- Nettoyer encodage.
- Corriger fonts reseau.
- Ajouter configuration API URL.
- Verifier build API apres nettoyage `dist`.

### Semaine 2 - Integration reelle

- Desactiver mocks par defaut.
- Tester tous les services front contre l'API.
- Corriger les divergences de contrats.
- Ajouter seed demo fiable.

### Semaine 3 - Securite et conformite

- Completer controles d'acces sync.
- Etendre tests RBAC.
- Revoir audit logs et confidentialite.
- Clarifier consentement FHIR/export.

### Semaine 4 - Pre-production

- CI complete.
- Docker API + Web + DB + Redis.
- Documentation d'installation.
- Tests E2E principaux.
- Jeu de donnees demo propre.

## Conclusion

Le projet a une base solide et beaucoup plus ambitieuse qu'avant. Les nouvelles briques backend montrent une vraie montee en maturite: validations, sessions, audit, RBAC, tests, sync, FHIR et consentement. La faiblesse principale n'est pas l'idee ni l'architecture generale: c'est la stabilite operationnelle. Aujourd'hui, il faut d'abord rendre le projet buildable, propre en encodage, configurable par environnement et testable sans mocks implicites.

Une fois ces corrections faites, BaoBaoHealth pourra passer d'un MVP riche a une base pre-production beaucoup plus credible.

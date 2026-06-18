# Analyse Projet - BaoBaoHealth

## Vue d'ensemble

BaoBaoHealth est un monorepo npm compose de:

- `apps/api`: backend Express + Prisma
- `apps/web`: frontend Angular + PrimeNG
- `packages/shared-types`: types TypeScript partages
- `docker`: PostgreSQL et Redis

Le projet vise une plateforme de sante multi-roles pour patients, ASC, medecins, pharmaciens et administrateurs.

## Lecture rapide

Analyses detaillees:

- [Analyse Backend](./ANALYSE_BACKEND.md)
- [Analyse Frontend](./ANALYSE_FRONTEND.md)

## Etat actuel

Points solides:

- Architecture monorepo claire.
- Backend separe en routes, controllers, services et middlewares.
- Frontend separe par roles et modules fonctionnels.
- Modele metier Prisma riche.
- Authentification JWT et RBAC deja presents.
- Design system frontend avance.

Points bloquants:

- Build backend casse par la configuration TypeScript.
- Build frontend bloque par l'import distant Google Fonts dans l'environnement actuel.
- Prisma schema, migrations et client genere ne semblent pas parfaitement synchronises.
- Inscription publique backend trop permissive sur le role.
- Types partages pas alignes avec les contrats reels.

## Priorites globales

1. Corriger la faille de role sur `/auth/register`.
2. Remettre le build backend au vert.
3. Synchroniser Prisma schema, migrations et client genere.
4. Remettre le build frontend au vert sans dependance reseau fragile.
5. Centraliser les contrats API dans `packages/shared-types`.
6. Ajouter validations DTO backend.
7. Ajouter tests sur les flux critiques.

## Commandes testees

Backend:

```bash
npm.cmd run build:api
```

Resultat: echec TypeScript.

Frontend:

```bash
npm.cmd run build:web
```

Resultat: echec sur Google Fonts a cause de l'acces reseau bloque.

## Notes

Il y a des modifications locales deja presentes dans les fichiers lies au pharmacien. Elles n'ont pas ete modifiees pendant cette analyse.

Des fichiers generes apparaissent aussi dans le statut Git:

- `apps/api/prisma.config.d.ts`
- `apps/api/prisma.config.d.ts.map`
- `apps/api/prisma.config.js`
- `apps/api/prisma.config.js.map`


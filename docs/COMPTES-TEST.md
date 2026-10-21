# Comptes de test

> **Base de développement locale uniquement.** Ces comptes sont créés par
> `npm run prisma:seed` puis `npm run prisma:seed:demo` (dossier `apps/api`).
> Leurs mots de passe sont publics : ils ne doivent jamais exister sur une base
> de production.

## Se connecter

1. Lancer l'API : `cd apps/api && npm run dev`
2. Lancer le front : `cd apps/web && npx ng serve`
3. Ouvrir http://localhost:4200

Docker Desktop doit être démarré : il fait tourner PostgreSQL et Redis.

- **Professionnels** : connexion par **email**, puis un code OTP à 6 chiffres.
  En développement, l'email n'est pas envoyé : le code s'affiche dans le
  terminal de l'API.
- **Patients** : connexion par **téléphone**, sans OTP.
- Après 20 tentatives en 15 minutes, l'API répond « Too many requests ».
  Attendre 15 minutes.

## Administration

| Rôle | Identifiant | Mot de passe |
|---|---|---|
| Super admin | cecedjibrilpricemou1er@gmail.com | `baobao1234` |
| Admin national | admin.national@demo.test | `Pricemou1234` |
| Admin de structure (Hôpital Donka) | admin.donka@demo.test | `Pricemou1234` |

## Assurance et pharmacies

| Rôle | Identifiant | Mot de passe | À quoi il sert |
|---|---|---|---|
| Agent assureur (Pricemou & Frere Assurances, PFA) | agent.pfa@demo.test | `Pricemou1234` | Contrats d'entreprise, polices individuelles, bénéficiaires, taux |
| Pharmacien titulaire, Pharmacie Pricemou (indépendante) | pharma.pricemou@demo.test | `Pricemou1234` | Caisse ; gère ses propres conventions |
| Pharmacien titulaire, Pharmacie de l'Hôpital Donka | pharma.donka@demo.test | `Pricemou1234` | Caisse ; hérite des conventions de l'hôpital |

## Patients

| Patient | Téléphone | Mot de passe | Situation |
|---|---|---|---|
| Maomou Conde | 620100010 | `Pricemou1234` | Identité vérifiée, police individuelle PFA à 100 % active |
| Fanta Camara | 620100013 | `Pricemou1234` | Identité vérifiée, à rattacher à un contrat d'entreprise |
| Ibrahima Sylla | 620100014 | `Pricemou1234` | Identité vérifiée, à rattacher à un contrat d'entreprise |
| Aissatou Bah | 620100015 | `Pricemou1234` | Identité **provisoire** : le tiers payant lui est refusé |

## Autres professionnels

| Rôle | Identifiant | Mot de passe |
|---|---|---|
| Médecin (Hôpital Donka) | david.medecin@demo.test | `Pricemou1234` |
| Agent d'accueil (Hôpital Donka) | accueil.donka@demo.test | `Pricemou1234` |
| Agent de santé communautaire | asc.donka@demo.test | `Pricemou1234` |
| Technicien de laboratoire (Laboratoire Cece) | tech.cece@demo.test | `Pricemou1234` |
| Second laborantin, celui qui valide (Laboratoire Cece) | bio.cece@demo.test | `Pricemou1234` |

## Situation de départ pour tester l'assurance

- Une seule convention existe : **Pharmacie Pricemou ↔ PFA**.
- L'Hôpital Donka n'a déclaré aucun assureur. Sa pharmacie refuse donc le tiers
  payant d'une carte PFA (« pas conventionné ») tant que l'admin de l'hôpital
  n'a pas activé PFA dans ses assureurs partenaires. Après activation, la même
  carte passe sans rien changer côté pharmacie.
- Aucun contrat d'entreprise n'existe : l'agent assureur le crée depuis
  **Contrats**, puis ajoute les travailleurs avec **Ajouter un travailleur**
  (informations de la pièce d'identité et photo) ou **Importer la liste du
  personnel** (CSV, modèle téléchargeable). Si le téléphone saisi correspond
  à un compte existant au même nom (Fanta Camara, Ibrahima Sylla), la fiche s'y
  rattache ; sinon un compte est créé, avec un mot de passe temporaire affiché
  une seule fois. Chacun retrouve alors sa carte dans **Cartes d'assurance**.
- Le tiers payant exige, au choix, une identité vérifiée à l'accueil ou une
  fiche de l'assureur avec pièce non expirée **et photo**. Au comptoir, la
  photo s'affiche et le pharmacien doit cocher qu'il l'a comparée avant
  d'encaisser.

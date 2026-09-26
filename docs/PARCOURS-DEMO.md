# Parcours de démonstration « Pricemou »

> Jeu de données pour dérouler le parcours complet à la main : hôpital → laboratoire → consultation → ordonnance → pharmacie.
>
> **Base de développement uniquement.** Tous les comptes partagent un mot de passe connu.

```bash
cd apps/api && npm run prisma:seed:demo
```

Le script est **idempotent** : il peut être rejoué sans rien casser.

---

## Les comptes

**Mot de passe de tous les comptes : `Pricemou1234`**

| Rôle | Nom | Identifiant | Structure |
|---|---|---|---|
| PATIENT | Maomou Condé | **téléphone** `620100010` | — |
| AGENT_ACCUEIL | Fatoumata Keïta | `accueil.donka@demo.test` | Hôpital Donka |
| MEDECIN | **David** Camara | `david.medecin@demo.test` | Hôpital Donka |
| TECHNICIEN_LABO | Sékou Cécé | `tech.cece@demo.test` | Laboratoire Cécé |
| BIOLOGISTE | Aminata Cécé | `bio.cece@demo.test` | Laboratoire Cécé |
| PHARMACIEN | Ousmane Pricemou | `pharma.pricemou@demo.test` | Pharmacie Pricemou |
| ADMIN_STRUCTURE | Mariama Sow | `admin.donka@demo.test` | Hôpital Donka |

> Les **professionnels passent par un OTP**. Gmail n'étant pas configuré, le code s'affiche à l'écran. Le **patient se connecte par téléphone, sans OTP**.

## Les structures

| Structure | Type | Quartier | Partenaire |
|---|---|---|---|
| Hôpital Donka | CHU | Donka | non |
| Laboratoire Cécé | LABORATOIRE | Donka | **oui** |
| Pharmacie Pricemou | PHARMACIE | Donka | **oui** |

**Tout se joue dans le même quartier, et ce n'est pas un hasard** : l'appel aux pharmacies (P6) cherche dans le quartier du patient. Une pharmacie ailleurs ne serait jamais sollicitée, et le parcours s'arrêterait sans explication.

## La patiente

Maomou Condé, née le 17/03/1992. QR : `DEMO-QR-MAOMOU-0001`.

- **Allergie déclarée : Amoxicilline** — pour voir l'alerte de prescription se déclencher.
- **Maladie chronique : Asthme.**

## Le catalogue

| Médicament | ATC | Particularité |
|---|---|---|
| Paracétamol 500mg | N02BE01 | le cas ordinaire |
| Amoxicilline 500mg | J01CA04 | **déclenche l'alerte d'allergie** |
| Metformine 850mg | A10BA02 | contre-indication « Insuffisance rénale » |
| Morphine 10mg | N02AA01 | **produit réglementé** |

500 boîtes de chacun en stock à la Pharmacie Pricemou.

---

## Le parcours, dans l'ordre

### 1. Accueil — ouvrir l'épisode et demander des analyses

Connexion **Fatoumata Keïta**. Rechercher Maomou Condé, ouvrir un épisode de soins, prescrire une analyse vers le **Laboratoire Cécé**. Le bon d'examen est imprimable.

Puis **orienter la patiente vers le Dr David Camara**, avec ou sans date. Le médecin reçoit une notification et retrouve la patiente dans *Orientations* — c'est par là qu'il la prend en charge à l'étape 3.

### 2. Laboratoire — du prélèvement au résultat validé

**Sékou Cécé** (technicien) reçoit la demande, planifie le prélèvement, saisit les résultats.
**Aminata Cécé** (biologiste) valide — *la validation est bloquante* : rien ne se diffuse avant.

> Pour voir le circuit des valeurs critiques, saisir une valeur hors des seuils de l'examen.

### 3. Médecin — consulter et prescrire

Connexion **Dr David Camara**. Menu **Orientations** : la patiente que l'accueil lui a adressée s'y trouve, avec le motif et l'heure du rendez-vous. Un rendez-vous déjà passé est signalé « à voir ».

**Ce qu'il faut essayer, dans cet ordre :**

| Choisir | Attendu |
|---|---|
| **Paracétamol** | rien de particulier — le cas ordinaire |
| **Amoxicilline** | bandeau rouge **« Allergie déclarée »** + champ **motif de dépassement** obligatoire |
| **Morphine** | bandeau **« Produit réglementé »**, champ *renouvellements* **verrouillé** |

Puis signer l'ordonnance. Elle reçoit alors son **numéro** (`OR-2026-…`) et son **code de vérification**.

> Basculer en mode sombre pour vérifier les couleurs.

### 4. Patiente — retrouver son ordonnance

Connexion **Maomou** (`620100010`). *Mes ordonnances* : le numéro, le code **masqué** qui se dévoile d'un geste, et l'impression.

### 5. Pharmacie — vérifier et délivrer

Connexion **Ousmane Pricemou**. Deux entrées :

- **scanner le QR** `DEMO-QR-MAOMOU-0001` ;
- ou **saisir le numéro + le code** de l'ordonnance (EF-07-01).

Essayer un **code faux** : le refus doit être indiscernable d'un numéro inconnu. Puis délivrer — **ligne par ligne**.

---

## Ce qui n'est pas encore testable

Ces points ont une **API mais pas d'écran**, ou pas de modèle du tout.

| Point | État |
|---|---|
| **Appel aux pharmacies du quartier** (P6) | API livrée, **aucun écran**. Testable via `POST /api/v1/commandes`. |
| **Assurance « Pricemou & Frère »** | **Impossible à créer** : ni modèle `Assureur`, ni type de structure « assurance ». C'est P10, non construit. |
| Offres des motards, suivi sur carte | P8, non construit. |
| Paiement | P7, non construit. |
| Interactions médicamenteuses | Le référentiel est **vide** — aucune donnée clinique n'a été inventée. Les alertes d'allergie et de contre-indication, elles, fonctionnent. |

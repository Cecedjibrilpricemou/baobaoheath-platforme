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
| TECHNICIEN_LABO | Aminata Cécé | `bio.cece@demo.test` | Laboratoire Cécé |
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

La semence en met **500 boîtes de chacun** en stock à la Pharmacie Pricemou, **chacune en un lot** portant une péremption à quatre mois — l'écran des péremptions a donc quelque chose à montrer d'emblée.

> Le paracétamol affiche davantage : la facture de démonstration **AP-2026-000001** (*Grossiste Kindia*, 2 lots) lui en a ajouté. C'est voulu — elle donne au bloc approvisionnement une entrée à montrer, et la semence ne l'écrase pas.

### Et quatre articles qui ne sont pas des médicaments

Depuis la décision du 2026-10-01, le catalogue en accepte. Ils n'ont **ni DCI, ni forme, ni dosage**, et c'est précisément ce que l'ancien modèle ne savait pas porter.

| Article | Catégorie | Prix |
|---|---|---|
| Lait infantile 1er âge 400g | `LAIT_INFANTILE` | 45 000 GNF |
| Crème hydratante 100ml | `COSMETIQUE` | 30 000 GNF |
| Savon antiseptique | `HYGIENE` | 12 000 GNF |
| Thermomètre digital | `DISPOSITIF_MEDICAL` | 85 000 GNF |

60 unités de chacun en stock. **Deux choses à vérifier** :

- côté **pharmacien**, l'écran des stocks et la saisie de facture proposent les **9 produits** ;
- côté **médecin ou ASC**, la liste de prescription n'en propose que **5** — on ne prescrit pas du lait. L'API le refuserait de toute façon, mais autant ne pas le proposer.

---

## Le parcours, dans l'ordre

### 1. Accueil — ouvrir l'épisode et demander des analyses

Connexion **Fatoumata Keïta**. Rechercher Maomou Condé, ouvrir un épisode de soins, prescrire une analyse vers le **Laboratoire Cécé**. Le bon d'examen est imprimable.

Puis **orienter la patiente vers le Dr David Camara**, avec ou sans date. Le médecin reçoit une notification et retrouve la patiente dans *Orientations* — c'est par là qu'il la prend en charge à l'étape 3.

### 2. Laboratoire — du prélèvement au résultat validé

**Sékou Cécé** (technicien) reçoit la demande, planifie le prélèvement, saisit les résultats.
**Aminata Cécé** (second laborantin) valide — *la validation est bloquante* : rien ne se diffuse avant.

> Le rôle de biologiste a été supprimé le 2026-09-30 : il n'y en a pas dans ces laboratoires. Quelqu'un continue de signer, et son nom reste sur le compte rendu.

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

### 6. Pharmacie — tenir le stock par lots

Toujours sous **Ousmane Pricemou**, deux entrées nouvelles dans la barre.

**Approvisionnement.** *Saisir une facture* : un fournisseur, un numéro, puis **une ligne par lot** — même produit, deux dates de péremption différentes. C'est précisément ce que l'ancien modèle ne savait pas porter. Le total se recalcule à la frappe. À l'enregistrement, l'entrée rejoint l'historique en montrant ses lots.

Un refus à essayer, il est volontaire : mettre une **péremption déjà passée** sur une ligne. L'enregistrement est refusé et le motif s'affiche tel quel — *« Un lot déjà périmé ne peut pas entrer en stock »*. Laisser entrer un tel lot ferait sortir un produit périmé plus tard.

> Un second garde-fou existe côté API — une facture citant un **produit hors catalogue** est rejetée — mais il n'est **pas atteignable depuis l'écran** : la liste ne propose que des produits du catalogue.

**Péremptions.** L'horizon se choisit (30/60/90/180 jours). Les lots **déjà périmés** sont présentés à part, en tête : ils sont à retirer, pas à surveiller. Le lot saisi à 40 jours disparaît de la liste si l'on redescend à 30 jours.

La facture de démonstration **AP-2026-000001** (*Grossiste Kindia*, 2 lots) est déjà en base.

> La sortie de stock suit la péremption la plus proche, pas l'ordre d'arrivée. Ce n'est pas visible à l'écran : cela se constate en délivrant une ordonnance, puis en regardant quel lot a baissé.

### 7. Pharmacie — la caisse et le tableau de bord

Toujours sous **Ousmane Pricemou**. Deux entrées de plus : *Caisse* et *Tableau de bord*.

**Caisse.** Les neuf produits sont proposés **avec leur quantité disponible**. Choisissez du paracétamol, mettez 3 : le total suit la frappe. Ajoutez une remise : le net se recalcule. Le client est **facultatif** — un passant n'ouvre pas un dossier pour acheter du savon.

Trois refus à essayer, chacun annoncé **avant** l'encaissement plutôt qu'après :

- choisir la **Morphine** : un bandeau dit que l'ordonnance est obligatoire (EF-05-12), et le bouton reste bloqué jusqu'à ce qu'un numéro soit saisi ;
- demander **plus que le stock** : un bandeau le dit, le bouton se bloque ;
- choisir **Orange Money** sans numéro d'abonné : le champ apparaît, le bouton reste bloqué.

Puis encaisser. La vente rejoint la liste avec son numéro `VE-2026-NNNNNN`, ses lignes et sa catégorie.

**Annuler** la vente : un motif de cinq caractères au moins est exigé, la vente se barre et prend son badge, et **le stock revient exactement à ce qu'il était**. Ce n'est pas un retour client — EF-07-11 l'interdit — mais la correction d'une erreur de saisie.

**Tableau de bord.** Chiffre du jour, panier moyen, encaissements par moyen de paiement, dix produits les plus vendus sur trente jours, ruptures et lots à périmer. Faites une vente, revenez : le chiffre monte. Annulez-la, revenez : il redescend. **Les ventes annulées sont exclues de tous les agrégats** — une erreur de caisse corrigée ne gonfle pas le chiffre d'affaires.

> Le plafond de remise (20 % par défaut) et les catégories soumises à ordonnance s'administrent dans l'onglet **Comptoir** de l'écran de paramètres, qui demande un compte `SUPER_ADMIN`.

---

## Ce qui n'est pas encore testable

Ces points ont une **API mais pas d'écran**, ou pas de modèle du tout.

| Point | État |
|---|---|
| **Appel aux pharmacies du quartier** (P6) | API livrée, **aucun écran**. Testable via `POST /api/v1/commandes`. |
| **Assurance « Pricemou & Frère »** — rappel | C'est le **dernier bloc** de l'addendum. La vente au comptoir existe désormais pour y accrocher la prise en charge. |
| **Extraction automatique des factures** (OCR) | Non construite. La saisie assistée la remplace, la facture restant attachée en justificatif. |
| **Assurance « Pricemou & Frère »** | **Impossible à créer** : ni modèle `Assureur`, ni type de structure « assurance ». C'est P10, non construit. |
| Offres des motards, suivi sur carte | P8, non construit. |
| Paiement | P7, non construit. |
| Interactions médicamenteuses | Le référentiel est **vide** — aucune donnée clinique n'a été inventée. Les alertes d'allergie et de contre-indication, elles, fonctionnent. |

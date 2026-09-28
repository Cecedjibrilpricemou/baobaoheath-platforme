# Addendum au cahier des charges — points du chef de projet

> Réunion rapportée le **2026-09-28**, complétée le jour même. Ce document consigne les neuf points remontés, ce qu'ils impliquent concrètement, et **ce qu'ils changent dans ce qui est déjà livré**.
>
> Chaque constat sur l'existant a été vérifié dans le code, référence à l'appui. Les estimations sont de l'effort de développement pour une personne : **S** ≈ 1 j · **M** ≈ 2–3 j · **L** ≈ 4–6 j.

---

## Résumé pour décision

Trois de ces points **contredisent du code livré et en production**. Ce ne sont pas des ajouts, ce sont des reprises.

| Point | Nature | Ce que ça touche |
|---|---|---|
| Le médecin fixe les RDV | **reprise** | L'orientation livrée le 2026-09-26 |
| Plus de biologiste, juste laborantin | **reprise** | Le circuit de validation du laboratoire (P2, livré) |
| Résultats invisibles au patient sans accord du médecin | **reprise** | La diffusion automatique des résultats (P2, livré) |
| Gestion complète de la pharmacie | ajout lourd | Nouveau bloc, avec un blocage de modèle |
| Pointage de présence | ajout | Espace accueil |
| Assurance enrichie | précision sur P10 | Non commencé, donc sans casse |
| Agenda du médecin | ajout | Aucun écran n'existe ; l'index en base, si |
| Prise de RDV à distance | remontée de priorité | Était en lot V4 (P13) |
| Téléconsultation | **différée** | Décision du chef de projet : « on verra un peu plus tard » |

**Le point le plus coûteux n'est pas le plus visible** : l'approvisionnement par facture bute sur une limite du modèle de stock, décrite au point 1.3.

---

## 1. Gestion complète d'une pharmacie

C'est le bloc le plus volumineux des huit. Aujourd'hui, l'espace pharmacien contient **deux écrans** : les ordonnances et les stocks (`apps/web/src/app/features/pharmacien/`). Il n'y a ni tableau de bord, ni vente, ni approvisionnement.

### 1.1 Tableau de bord des ventes · M

**Ce qui manque n'est pas l'écran, c'est l'objet.** Le modèle `Facture` est attaché à une consultation :

```prisma
idConsultation String? @unique
```

Une pharmacie qui vend une boîte de paracétamol à quelqu'un qui passe **n'a rien pour l'enregistrer**. Il n'existe pas de vente au comptoir dans le système — donc rien à totaliser dans un tableau de bord.

Il faut donc d'abord un modèle de **vente** (lignes, remise, mode de paiement, vendeur, avec ou sans ordonnance, avec ou sans assurance), puis le tableau de bord se contente de le lire : chiffre du jour, produits les plus vendus, ruptures, encaissements par mode.

### 1.2 Import Excel du catalogue · S

Téléversement d'un fichier, prévisualisation, rapport ligne par ligne (créés / mis à jour / refusés avec le motif). **Un import qui échoue silencieusement sur trois lignes sur mille est pire que pas d'import** : il faut que le pharmacien voie ce qui n'est pas passé.

À brancher sur le même mécanisme que l'import des référentiels prévu en P11.

### 1.3 Approvisionnement par scan de facture · L — ⚠️ blocage de modèle

L'idée : on présente la facture du fournisseur, et les produits entrent en stock avec leur quantité et leur date de péremption.

**Le modèle de stock actuel ne peut pas recevoir ça.**

```prisma
model Stock {
  quantite        Int
  datePeremption  DateTime?
  @@unique([idStructure, idMedicament])
}
```

Une seule ligne par produit et par pharmacie, donc **une seule date de péremption**. Or un approvisionnement apporte précisément des **lots** : 300 boîtes de paracétamol périmant en mars, 500 autres périmant en novembre. Le modèle actuel écraserait l'une des deux dates — et le stock afficherait une péremption fausse.

Il faut introduire un modèle **`LotStock`** (produit, quantité, date de péremption, facture d'origine, prix d'achat), `Stock` devenant la somme de ses lots. C'est une migration avec reprise des données existantes.

> C'est aussi ce qui permet de sortir au plus proche de la péremption plutôt qu'au hasard — la règle attendue dans une pharmacie.

**La lecture du document est un second sujet, indépendant.** Un scan de facture demande de l'OCR, et les factures des grossistes guinéens n'ont pas de format commun. Je recommande de livrer en deux temps :

1. **Saisie assistée** : le pharmacien photographie la facture, qui reste attachée comme justificatif, et saisit les lignes. Le stock et les lots sont corrects dès le premier jour.
2. **Extraction automatique** ensuite, avec **validation obligatoire à l'écran avant enregistrement**. Une erreur d'OCR sur une quantité ou une péremption entre silencieusement dans le stock d'un médicament — cela ne doit jamais partir sans relecture humaine.

### 1.4 Alerte sur les péremptions proches · S

Découle directement du point précédent : sans les lots, l'alerte porterait sur une date fausse. Seuil paramétrable (30/60/90 jours), file triée, et blocage de la délivrance d'un lot périmé.

### 1.5 Mobile money ou espèces · déjà en place

```prisma
enum ModePaiement { ESPECES  ORANGE_MONEY  MTN_MOMO }
```

Rien à modéliser. Ce qui reste est le raccordement réel aux opérateurs, déjà prévu en P7 derrière `payment-provider.service`, et jusqu'ici simulé.

---

## 2. Pointage de présence et orientation · M

**Décision prise : c'est le rôle `AGENT_ACCUEIL`**, dont l'intitulé affiché devient « Assistante ». Pas de nouveau rôle, pas de nouvelles permissions, pas de comptes à migrer.

Ce qui s'ajoute à son espace :

- **La file des patients attendus aujourd'hui**, avec leur médecin et l'heure de leur rendez-vous.
- **Le pointage à l'arrivée** : le patient est présent, l'attente commence, le médecin le voit arriver dans sa file.
- **La redirection au bon moment** : l'assistante envoie le patient vers le médecin quand celui-ci est disponible.

Cela suppose un état de présence sur le rendez-vous (`ATTENDU` → `PRESENT` → `EN_CONSULTATION` → `TERMINE`), et non plus le seul `PLANIFIE` d'aujourd'hui.

---

## 3. Le médecin fixe les rendez-vous — ⚠️ reprise

**Décision prise : seul le médecin crée le rendez-vous.** L'accueil oriente sans proposer d'heure.

### Ce qui existe aujourd'hui

Le rendez-vous est créé **uniquement** par l'agent d'accueil, dans `orienter()` :

```
apps/api/src/services/hopital.service.ts:358 — tx.rendezVous.create({...})
```

C'est le seul endroit du code qui crée un rendez-vous. **Le médecin n'en crée aucun.**

### Ce qui change

| Côté | Avant | Après |
|---|---|---|
| Accueil | oriente **et** fixe le créneau | oriente seulement ; le champ date disparaît |
| Médecin | subit le créneau | reçoit la demande et **fixe le créneau** |
| Patient | notifié de l'heure par l'accueil | notifié quand le médecin a fixé |

L'écran « Orientations » livré le 2026-09-26 **reste et sert** : c'est là que le médecin recevra la demande. Il gagne l'action « fixer le rendez-vous ». En revanche, sa colonne « avec rendez-vous / sans rendez-vous » change de sens — elle devient « à planifier / planifiés ».

**Effort : M.** Migration légère, reprise de l'écran d'accueil, nouvel agenda côté médecin.

---

## 4. Laboratoire : plus de biologiste — ⚠️ reprise

**Décision prise : le laborantin valide, le rôle `BIOLOGISTE` est supprimé.**

### Ce qui existe aujourd'hui

Le rôle `BIOLOGISTE` est exigé à **sept endroits**, dont la règle centrale :

```
apps/api/src/services/laboratoire.service.ts:239
  if (user.role !== 'BIOLOGISTE') throw new ForbiddenError('Seul un biologiste peut valider des resultats');
```

### Ce qui change

Le rôle disparaît ; `TECHNICIEN_LABO` — à renommer « laborantin » à l'affichage — reçoit la validation.

**La validation nominative reste bloquante** (EF-04-05). Ce n'est pas ce que le chef de projet remet en cause : il dit qu'il n'y a pas de biologiste en Guinée dans ces laboratoires, pas que les résultats doivent partir sans que personne ne les signe. **Quelqu'un continue de signer, et son nom reste sur le compte rendu.**

**À traiter obligatoirement :**

- **Migration des comptes existants** vers `TECHNICIEN_LABO`. Deux comptes de démonstration sont concernés (Aminata Cécé, Biologiste Demo). Sans migration, ils tombent sur `/unauthorized`.
- **Les comptes rendus déjà validés** portent le nom d'un biologiste. C'est un document médico-légal : on ne réécrit pas l'histoire. Le champ valideur reste tel quel sur l'existant.
- Le référentiel des rôles, les validateurs Zod, Swagger et l'écran d'administration de structure.

**Effort : M**, dont la moitié en migration et en vérification.

---

## 5. Assurance — précisions sur P10

P10 n'est pas commencé : ces précisions arrivent **avant** le code, ce qui est la bonne séquence. Elles enrichissent le bloc sans rien casser.

### 5.1 Vérifier qu'un patient est bien assuré chez nous

Contrôle d'éligibilité au comptoir : contrat actif, bénéficiaire inscrit, date d'effet, carence. Réponse immédiate, opposable, et **tracée** — c'est elle qui justifiera le tiers payant.

### 5.2 Situation des pharmacies partenaires

L'assureur doit voir, par pharmacie conventionnée : ce qui a été délivré, ce qui lui est facturé, ce qui est payé, ce qui reste dû, et les écarts. C'est le pendant du « dossier de facturation et suivi » déjà prévu (EF-09-06/07), vu depuis l'assureur au lieu de la plateforme.

### 5.3 Exclusions par catégorie de produit — ⚠️ point de modèle

Le chef de projet cite le lait et les cosmétiques : des produits qu'une assurance ne rembourse pas.

**Deux obstacles dans le modèle actuel :**

1. Le catalogue s'appelle `Medicament`. **Le lait infantile et les cosmétiques ne sont pas des médicaments** — or une pharmacie en vend. Il faut que le catalogue accepte des articles qui n'en sont pas.
2. Le champ `categorie String?` existe mais il est **en texte libre et facultatif**. On ne peut pas fonder une règle de remboursement sur un champ que chacun remplit comme il veut : « cosmétique », « Cosmetique » et « cosmetiques » seraient trois catégories différentes, et une exclusion en manquerait deux.

Il faut une **catégorie issue d'un référentiel fermé**, administrable — c'est elle que les exclusions d'assurance viendront viser.

### 5.4 Taux, y compris 100 %

Déjà prévu (EF-09-03), mais deux précisions valent d'être écrites :

- **Un taux de 100 % ne veut pas dire « tout est pris »** : il s'applique à ce qui est couvert, après exclusions et dans la limite des plafonds. Un assuré à 100 % paie quand même son lait infantile.
- L'écran doit montrer **le détail ligne par ligne avant paiement** : ce qui est couvert, à quel taux, ce qui est exclu **et pourquoi**. Un reste à charge sans explication se conteste au comptoir.

---

## 6. Téléconsultation · L — remontée de priorité

Aujourd'hui en **P13, lot V4** (EF-05-10/11), c'est-à-dire hors d'une première mise en service. Le chef de projet la place dans le parcours courant. **Aucune ligne de code n'existe** (`grep -i teleconsult` : aucun résultat).

Le parcours décrit :

```
PATIENT (chez lui)          MEDECIN                    ASSISTANTE
  demande de consultation ->  reçoit et fixe le RDV
                                                        (le jour J)
  arrive à l'hôpital ------------------------------->   pointe la présence
                                                        voit le médecin du RDV
                              <-------------------      redirige au bon moment
  consultation
```

**Ce parcours est cohérent avec les points 2 et 3** — c'est le même circuit vu depuis le patient. Les trois se construisent ensemble ; les séparer ferait faire le travail deux fois.

### Tranché le 2026-09-28 : les deux, mais pas en même temps

Tel que décrit ci-dessus, le patient **se déplace quand même** : ce n'est pas une consultation à distance, c'est une **prise de rendez-vous à distance**. La distinction a été posée, et le chef de projet a tranché :

| | Périmètre | Quand |
|---|---|---|
| **Prise de rendez-vous à distance** | Le patient demande sa consultation depuis chez lui, le médecin fixe le créneau, l'assistante le pointe à l'arrivée. | **Maintenant** — bloc 4 de l'ordonnancement |
| **Téléconsultation réelle** | Le médecin voit le patient sans qu'il se déplace : visioconférence, acte à distance, traçabilité. | **Plus tard** — reste suspendue à la décision **D2** (cadre légal) |

> C'est le bon ordre. La téléconsultation réelle a besoin du circuit de rendez-vous à distance pour exister : on ne consulte pas à distance quelqu'un qui n'a pas pu prendre rendez-vous à distance. Construire le premier ne sera pas perdu, ce sera le socle du second.

---

## 7. Les résultats ne sont visibles qu'après accord du médecin — ⚠️ reprise

> « Le patient ne doit pas pouvoir voir les résultats de test avant que le médecin l'autorise ou les traduise, car il peut contenir des termes de médecin dont le patient ne comprend pas forcément le sens. »

**C'est juste, et c'est exactement ce que le code ne fait pas aujourd'hui.**

### Ce qui existe

```
apps/api/src/services/laboratoire.service.ts:257
  diffuseePatientLe: critiques.length ? null : maintenant,
```

À la validation du laboratoire : si le résultat n'a **rien de critique**, il part **immédiatement** chez le patient. Seuls les résultats critiques attendent — et encore, pas le médecin, mais son accusé de lecture, avec une **diffusion automatique au bout de 24 h** (ligne 367).

Autrement dit : aujourd'hui, le cas courant va directement au patient sans qu'aucun médecin l'ait vu, et le cas grave finit par y aller tout seul.

### Ce qui change

La diffusion devient **un geste du médecin**, jamais un effet du temps :

- À la validation du laboratoire, le résultat part au **médecin prescripteur**, pas au patient.
- Le médecin **libère** le résultat, avec la possibilité d'y joindre un commentaire en langage clair — c'est le « traduire » du chef de projet.
- Le patient voit alors le résultat **et l'explication ensemble**.
- **La diffusion automatique à 24 h disparaît.** C'est précisément le mécanisme qui livrerait un résultat non traduit.

**Un garde-fou est nécessaire**, sinon un médecin absent laisse un patient sans ses résultats indéfiniment. Je propose une **relance du médecin**, puis une **escalade vers l'admin de structure** — le mécanisme existe déjà pour les valeurs critiques, il suffit de le réutiliser. **Escalader vers quelqu'un, jamais vers le patient.**

**Effort : M.** Le point délicat n'est pas le code, c'est de ne pas casser l'existant : les courbes d'évolution et « Mes résultats » côté patient filtrent déjà sur `diffuseePatientLe` et suivront la nouvelle règle sans modification.

---

## 8. Le médecin voit ses rendez-vous, dans l'ordre · S

> « Le docteur doit voir une liste de ses rendez-vous par ordre. »

Point ajouté le 2026-09-28. **Aucun écran de ce genre n'existe** : l'espace médecin contient un tableau de bord, les consultations, les référencements, la messagerie et les orientations — pas d'agenda.

### La bonne nouvelle

Le modèle est déjà prêt, et il a même été indexé pour cette requête exacte :

```prisma
model RendezVous {
  prevuLe   DateTime
  idMedecin String?
  @@index([idMedecin, prevuLe])
}
```

Il ne manque que l'endpoint et l'écran. **C'est le point le moins cher des neuf**, et c'est aussi celui qui rend le point 3 utilisable : dès lors que le médecin fixe lui-même ses rendez-vous, il lui faut l'endroit où les voir. Les deux se livrent ensemble.

### Ce que l'écran doit montrer

- **Par ordre chronologique, le plus proche en premier**, groupé par jour — « aujourd'hui », « demain », puis les dates.
- Pour chacun : le patient, son âge, le motif, l'heure, et **son état de présence** (attendu, présent, en consultation, terminé) une fois le pointage du point 2 en place.
- **Aujourd'hui d'abord** : c'est la vue dont le médecin se sert le matin.
- Un rendez-vous dépassé sans que le patient soit venu se signale, comme le fait déjà l'écran d'orientations.

### Un point de modèle à corriger au passage

```prisma
statut String @default("PLANIFIE")
```

Le statut du rendez-vous est une **chaîne libre**, pas une énumération : la base n'interdit aucune valeur, et une faute de frappe passerait sans erreur. Puisque le point 2 y ajoute des états de présence, autant le fermer en `enum` à ce moment-là — c'est la migration la moins chère qu'on aura l'occasion de faire ici.

---

## Ce qu'il reste à trancher

| # | Question | Pourquoi ça bloque |
|---|---|---|
| ~~A~~ | ~~Téléconsultation : à distance pour de vrai, ou prise de RDV à distance ?~~ | **Tranché le 2026-09-28** : la prise de rendez-vous à distance se fait **maintenant**, la téléconsultation réelle **plus tard** (toujours suspendue à D2). |
| B | Scan de facture : saisie assistée d'abord, extraction automatique ensuite ? | Détermine si le bloc pharmacie est livrable en une fois ou en deux. |
| C | Le catalogue doit-il accepter des articles non médicamenteux (lait, cosmétiques) ? | Conditionne le modèle de catalogue **et** les exclusions d'assurance. |
| D | Résultats : qui libère quand le prescripteur est un agent d'accueil et non un médecin ? | L'accueil peut prescrire des analyses (EF-03-03) mais ne peut pas traduire un résultat. |
| E | Vente au comptoir sans ordonnance : autorisée pour tous les produits ? | Un produit réglementé ne se vend pas sans ordonnance (EF-05-12). |

---

## Proposition d'ordonnancement

Les trois reprises d'abord : elles portent sur du code en production, et **chaque jour qui passe les rend plus chères** — les données s'accumulent sous les anciennes règles.

| Ordre | Bloc | Taille | Justification |
|---|---|---|---|
| 1 | **Résultats libérés par le médecin** (point 7) | M | Le seul point à conséquence clinique. Aujourd'hui un patient peut lire un résultat que personne ne lui a expliqué. |
| 2 | **RDV fixés par le médecin + agenda + pointage** (points 2, 3, 8) | M | Un seul circuit, une seule reprise. Séparer ferait refaire l'écran d'accueil deux fois — et un médecin qui fixe ses rendez-vous a besoin de l'endroit où les voir. |
| 3 | **Suppression du rôle biologiste** (point 4) | M | Migration de comptes : plus elle tarde, plus il y a de comptes et de comptes rendus concernés. |
| 4 | **Demande de rendez-vous à distance par le patient** (point 6) | M | Se branche sur le circuit RDV du bloc 2, qui doit exister avant. La **téléconsultation réelle** n'est pas dans ce total : elle attend D2. |
| 5 | **Pharmacie : lots, approvisionnement, péremptions** (points 1.3, 1.4) | L | Le blocage de modèle est ici. À faire avant la vente, qui s'appuie dessus. |
| 6 | **Pharmacie : vente et tableau de bord** (points 1.1, 1.2) | M | Suppose les lots. |
| 7 | **Assurance** (point 5) | L | Inchangé en P10, enrichi des précisions ci-dessus. Suppose la catégorie de produits. |

**Total estimé : ~20 à 27 jours de développement**, hors recette et hors décisions externes.

---

## Effet sur la feuille de route

- **P2 (laboratoire)** et **P1 (épisode de soins)**, marqués livrés, sont **rouverts** par les points 3, 4 et 7.
- **P6 (commande pharmacie)** s'élargit à la gestion de l'officine : ce n'est plus seulement servir des ordonnances, c'est **tenir une pharmacie**.
- **P10 (assurance)** ne change pas de périmètre, il gagne des règles.
- **P13 (lot V4)** perd la téléconsultation, qui remonte.

La feuille de route `FEUILLE_DE_ROUTE_KENEYA.md` est mise à jour en conséquence.

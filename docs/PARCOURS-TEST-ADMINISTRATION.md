# Parcours de test — administration, audit et identité

> Écrit le 2026-10-04, après la livraison de P11 (EF-12-01, 03, 04, 05, 06, 09) et du premier pas de P4 (EF-01-04/10).
> État des données vérifié le même jour, directement en base.
>
> **À qui ce document s'adresse** : à vous, pour dérouler vous-même ce qui a été construit. Chaque étape dit ce que vous devez voir, et **pourquoi** — un écran qui affiche la bonne chose pour la mauvaise raison reste un écran faux.

---

## Avant de commencer

**L'API et le front doivent tourner tous les deux.**

```bash
cd baobaoheath-platforme
npm run dev          # API (3000) + web (4200)
```

Si le front affiche « identifiants incorrects » alors que le mot de passe est bon, c'est presque toujours que l'API ne répond pas. Vérifiez : `curl http://localhost:3000/health`.

### Les comptes dont vous aurez besoin

| Rôle | Identifiant | Mot de passe | Ce qu'il sert à tester |
|---|---|---|---|
| **SUPER_ADMIN** | `cecedjibrilpricemou1er@gmail.com` | `baobao1234` | Journal d'audit, comptes, demandes RGPD, anomalies |
| **AGENT_ACCUEIL** | `accueil.donka@demo.test` | `Pricemou1234` | Vérification d'identité |
| **MEDECIN** | `david.medecin@demo.test` | `Pricemou1234` | Provoquer une anomalie, être suspendu |
| **PATIENT** | `620100010` *(téléphone)* | `Pricemou1234` | Journal des accès, demandes RGPD |

> Les comptes à adresse e-mail passent par un code à usage unique affiché à l'écran en développement. La patiente, elle, entre directement.

### État des données au moment où ce document est écrit

- **10 patients** : 3 à l'identité vérifiée, **7 provisoires**
- **3 demandes RGPD** : 1 reçue, 1 satisfaite, 1 refusée
- **1 055 lignes** au journal d'audit
- **15 comptes fermés**, dont les 15 à moitié purgés du 2026-08-04
- **0 interaction médicamenteuse** en base — voir l'étape 7

---

## 1. Le journal des accès, côté patient (EF-02-08)

**Connectez-vous en patiente** (`620100010` / `Pricemou1234`) → **Mes consentements**.

Descendez jusqu'à **« Qui a accédé à mon dossier »**.

Vous devez voir :
- des lignes **rédigées**, pas des motifs de route : « Votre dossier a été consulté », « Votre code a été scanné au comptoir » ;
- vos propres accès marqués **« Vous »**, sur fond atténué ;
- une bascule **« Afficher seulement les accès par une autre personne »**.

**Actionnez la bascule.** Le nombre doit chuter, et plus aucune ligne « Vous avez… » ne doit rester.

> **Pourquoi cela compte** : avant le 03/10, cette page existait mais sa requête manquait les scans de code QR au comptoir — 30 accès invisibles pour cette patiente. Et elle affichait `GET /:id`.

---

## 2. Ses droits sur ses données (EF-12-09)

Toujours en patiente, sur la même page, section **« Mes droits sur mes données »**.

**Choisissez « Faire effacer mes données »** et lisez le texte qui apparaît avant d'envoyer quoi que ce soit.

Il doit dire qu'un dossier de soins **ne peut pas être supprimé**, pourquoi la trace des accès doit subsister, et ce qui est possible à la place — l'anonymisation de l'identité.

> **Pourquoi cela compte** : promettre une suppression qui ne viendra pas serait pire que de ne rien proposer.

**Choisissez ensuite « Corriger une information inexacte »** : le bouton reste inactif tant que vous n'avez pas écrit au moins dix caractères, et l'écran dit pourquoi.

Envoyez une demande. Vous devez lire **la date limite** de réponse.

Plus bas, la demande d'effacement déjà refusée affiche **le motif en entier** et qui a répondu.

---

## 3. Traiter la demande (EF-12-09, côté administration)

**Déconnectez-vous, connectez-vous en SUPER_ADMIN** → **Demandes RGPD**.

Vous devez voir la demande que vous venez de déposer, avec son délai.

**Prenez-la en charge**, puis **Satisfaire** ou **Refuser**. Le bouton reste inactif sous dix caractères.

**Essayez sur une demande d'effacement** : un rappel s'affiche au moment de répondre — un dossier de soins ne se supprime pas. C'est là qu'il sert, pas dans une documentation.

---

## 4. Le journal d'audit (EF-12-04, EF-12-05)

**Journal d'audit**, toujours en SUPER_ADMIN.

En tête : **« Votre consultation de ce journal y est elle-même enregistrée. »** Ce n'est pas une formule — rechargez la page et cherchez la ressource `journal`, vous vous y verrez.

Essayez :
- le filtre **« Seulement les accès refusés »** — les lignes passent en rouge ;
- **Exporter en CSV** — le fichier s'ouvre dans Excel avec ses accents et ses colonnes séparées ;
- une **période à l'envers** (du 10/10 au 01/10) : refusée, avec un message.

> **Ce qu'on ne peut pas tester depuis l'écran** : le journal est en ajout seul. Même un accès direct à la base ne peut ni modifier, ni supprimer, ni vider la table — deux déclencheurs PostgreSQL le refusent.

---

## 5. Provoquer une anomalie (EF-12-06)

**Ouvrez une seconde fenêtre** (ou une fenêtre privée) et connectez-vous en **médecin** (`david.medecin@demo.test`).

Dans la barre d'adresse, allez **six fois** sur `http://localhost:4200/admin/journal`. Chaque tentative est refusée — c'est voulu, le médecin n'y a pas droit.

**Revenez à la fenêtre du SUPER_ADMIN**, rechargez **Journal d'audit**.

Un encart doit apparaître en tête : **« David Camara (Médecin) s'est vu refuser l'accès N fois, pour un seuil de 5 »**.

Lisez la phrase sous le titre : *« Ce sont des signaux, pas des verdicts. »* Et les seuils sont affichés, avec la mention qu'ils ne sont pas encore calibrés.

**Cliquez « Voir le détail »** : le tableau se filtre sur ce médecin, avec seulement ses refus.

> **Pourquoi ce n'est pas un verdict** : un soignant de garde consulte beaucoup de dossiers sans rien faire de mal, et un comptoir de pharmacie scanne des dizaines de codes par jour. Un détecteur qui trancherait ferait suspendre des gens à tort.

---

## 6. Suspendre un compte (EF-12-01)

**Comptes**, en SUPER_ADMIN. Cherchez `David`.

**Suspendez-le.** Une confirmation s'ouvre — jamais d'un seul clic — et dit ce qui va être coupé. Le bouton reste inactif sous dix caractères de motif.

Le message annonce ensuite **ce qui a réellement été coupé** : *« N session(s) et N connexion(s) temps réel coupées »*.

**Retournez à la fenêtre du médecin et rechargez.** Il doit être dehors.

**Essayez de vous suspendre vous-même** : refusé. C'est le dernier super-administrateur actif, et il n'y a **aucun compte `ADMIN_NATIONAL`** — voir la note en fin de document.

**Réactivez David** pour la suite.

---

## 7. Les référentiels (EF-12-03)

Il n'y a **pas encore d'écran** : l'import se fait par l'API. Le référentiel d'interactions est **vide**, donc aucune alerte d'interaction ne peut se déclencher aujourd'hui — il manque une source médicale validée, pas l'outil.

Pour l'essayer, la documentation interactive est sur `http://localhost:3000/api/docs`, section **Référentiels**.

---

## 8. Le verrou d'identité et le tiers payant (EF-01-04/10) — **le plus important**

**Connectez-vous en agent d'accueil** (`accueil.donka@demo.test`) → **Identités**.

Lisez l'avis en tête. Il dit que vérifier une identité ouvre le tiers payant, et que cela **ne conditionne pas les soins** : *« Ne refusez jamais quelqu'un parce qu'il n'a pas de pièce. »*

Vous voyez **7 patients provisoires**, chacun marqué **« Tiers payant fermé »**, et les traits qui manquent.

**Vérifiez-en un** :
- le bouton reste inactif tant que la pièce, son numéro et le lieu de naissance ne sont pas saisis ;
- la boîte dit que **vous déclarez** avoir vu la pièce, et que votre nom sera enregistré ;
- après validation, le message dit que le tiers payant est ouvert.

**Filtrez sur « Vérifiée »** : le numéro de pièce s'affiche **masqué** — `•••••••••6543`. Il prouve qu'une pièce a été vue, il n'a pas à être recopié devant la file d'attente.

### Ce qui se passe derrière

Maomou Condé est la seule patiente avec un contrat d'assurance actif, et son identité est **vérifiée** : le tiers payant fonctionne pour elle à la caisse.

Si vous voulez voir le verrou **refuser**, il faut un patient provisoire avec un contrat. Aucun n'existe aujourd'hui dans les données de démonstration.

> **Pourquoi ce verrou existe** : dans la région, « Mamadou Diallo, né en 1990 » peut désigner plusieurs personnes dans la même préfecture. Si l'identité est la mauvaise, c'est l'assureur qui paie pour quelqu'un d'autre — et le vrai titulaire qui voit son plafond annuel consommé sans le savoir. **L'assurance livrée le 02/10 facturait des tiers sur des identités simplement déclarées.**

---

## Ce que ce parcours ne couvre pas, et qu'il faut savoir

| Point | État |
|---|---|
| **Aucun compte `ADMIN_NATIONAL`** | Tous les écrans d'administration sont ouverts à `ADMIN_NATIONAL` **et** `SUPER_ADMIN`. Avec zéro compte national, toute l'administration repose sur un seul compte. |
| **L'anonymisation RGPD** | Pas construite. Une demande d'effacement se traite à la main, et la réponse écrite dit ce qui a été fait. |
| **Les 15 comptes à moitié purgés** | Téléphone remplacé le 2026-08-04, **noms restés lisibles**, aucune trace de qui l'a fait. À trancher. |
| **La durée légale de conservation** d'un dossier de soins en Guinée | Inconnue de moi. Elle détermine ce qu'on peut répondre à une demande d'effacement. |
| **Les seuils de détection d'anomalies** | Non calibrés sur du trafic réel. Affichés à l'écran pour cette raison. |
| **Import de référentiels** | API seulement, pas d'écran. |
| **Détection de doublons** (EF-01-05) | Les traits sont recueillis, la détection reste à construire. |

---

## Si quelque chose ne va pas

Notez **ce que vous faisiez, ce que vous attendiez, et ce que vous avez vu**. C'est le triplet qui permet de reproduire.

Les écrans sont vérifiés automatiquement dans les deux thèmes avant chaque livraison, mais une vérification automatique ne voit que ce qu'on lui a appris à regarder. Votre œil verra autre chose.

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
| **AGENT_ACCUEIL** | `accueil.donka@demo.test` | `Pricemou1234` | Vérification d'identité, doublons |
| **ADMIN_STRUCTURE** | `admin.donka@demo.test` | `Pricemou1234` | **Fusion de dossiers** et son annulation |
| **MEDECIN** | `david.medecin@demo.test` | `Pricemou1234` | Provoquer une anomalie, être suspendu |
| **PATIENT** | `620100010` *(téléphone)* | `Pricemou1234` | Journal des accès, demandes RGPD |

> Les comptes à adresse e-mail passent par un code à usage unique affiché à l'écran en développement. La patiente, elle, entre directement.

### État des données au moment où ce document est écrit

> Mis à jour le 2026-10-04 après la livraison d'EF-01-05.

- **13 patients** : 1 à l'identité vérifiée, **12 provisoires**
- Deux des trois identités « vérifiées » du 03/10 ne l'étaient pas : elles
  avaient été posées par mes propres tests d'écran, avec un faux numéro de
  pièce. Elles sont **remises en provisoire**, et les traits fabriqués retirés.
- **3 dossiers de démonstration** ont été créés volontairement pour
  l'étape 9 (voir cette étape) : `610000002`, `610000003`, `619000001`.
- **3 demandes RGPD** : 1 reçue, 1 satisfaite, 1 refusée
- **2 contrats d'assurance** : un sur une identité vérifiée, un sur une
  identité provisoire — c'est ce second qui permet enfin de voir le verrou du
  tiers payant **refuser**
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

Maomou Condé a un contrat d'assurance actif et son identité est **vérifiée** : le tiers payant fonctionne pour elle à la caisse.

**Aminata Camara a maintenant un contrat actif (`PFA-2026-00099`) et une identité provisoire.** C'est le cas qui manquait : passez à la caisse avec elle, et le tiers payant doit être **refusé**, avec le motif. Vérifiez que le motif parle d'identité, et non d'un défaut de couverture — ce ne sont pas les mêmes conséquences pour le patient.

Vérifiez ensuite son identité, et refaites le même passage : le tiers payant doit s'ouvrir.

> **Pourquoi ce verrou existe** : dans la région, « Mamadou Diallo, né en 1990 » peut désigner plusieurs personnes dans la même préfecture. Si l'identité est la mauvaise, c'est l'assureur qui paie pour quelqu'un d'autre — et le vrai titulaire qui voit son plafond annuel consommé sans le savoir. **L'assurance livrée le 02/10 facturait des tiers sur des identités simplement déclarées.**

---

## 9. Les doublons possibles (EF-01-05)

Toujours en agent d'accueil, sur **Identités**.

Trois dossiers ont été créés le 2026-10-04 **pour que cette étape soit
testable**, parce qu'aucune ressemblance n'existait dans les données :

| Dossier | Numéro | Ce qu'il sert à montrer |
|---|---|---|
| **Mamadou Diallo** | `619000001` | le dossier de départ |
| **Mamadou Dialo** | `610000002` | le même nom transcrit à l'oreille — une lettre. Porte **deux vaccinations**, pour que la fusion de l'étape 10 ait quelque chose à déplacer |
| **Ousmane Diallo** | `610000003` | un frère : tout concorde **sauf** le prénom |

Les trois portent la même mère (Kadiatou Barry), le même lieu (Mamou) et le
1er janvier 2000.

> Pour les retirer quand ils n'auront plus d'usage, supprimez les trois comptes
> par leur numéro de téléphone. Ils n'ont ni consultation ni contrat.

**Cliquez « Doublons possibles » sur la ligne de Mamadou Diallo.**

Vous devez voir les deux autres dossiers, et surtout :

- **aucun des deux n'est annoncé comme « Doublon probable »**, tous deux sont
  « À vérifier » ;
- sous *Ce qui concorde*, des phrases en français — « Même nom, écrit
  autrement », « Même date, mais une date par défaut (1er janvier) » — et non
  des codes ;
- pour **Mamadou Dialo** : *« Le nom concorde à l'orthographe près : à
  confirmer sur la pièce »* ;
- pour **Ousmane Diallo** : *« Le nom ne concorde pas : ce sont peut-être deux
  membres d'une même famille »* ;
- en bas, la phrase qui dit que **la fusion n'est pas encore outillée**. Il n'y
  a pas de bouton « Fusionner » : il ne ferait rien.

**Essayez sur un patient sans ressemblance** (« Diag Test » par exemple). Le
message ne dit pas « aucun doublon » tout court : il dit que cela **ne prouve
pas** qu'il n'y en a pas, parce que la recherche s'appuie sur le nom, le numéro
et le nom de la mère — un dossier dont aucun de ces traits n'est connu reste
invisible.

> **Pourquoi rien n'est annoncé « probable » ici.** Deux frères partagent leur
> mère, leur ville et le téléphone familial ; des jumeaux partagent en plus
> leur date. Tout concorde sauf le prénom, et le score atteignait 115 avant
> correction — bien au-delà du seuil. Fusionner deux frères mélangerait leurs
> dossiers médicaux. La règle est donc une **borne** et non un poids : sans
> concordance de nom exacte, aucun cumul de traits familiaux ne franchit le
> seuil. Même chose pour une variante d'orthographe, parce que « Mamadou » et
> « Amadou » peuvent être deux frères autant qu'une faute de transcription.

> **Pourquoi la date de naissance ne compte presque pas.** Dans la base,
> 9 patients sur 10 portaient le 1er janvier 2000 : c'est la valeur que l'on
> saisit quand on ignore la date. Un détecteur qui lui donnerait son poids
> habituel les signalerait tous comme doublons les uns des autres, et vous
> apprendriez à ignorer l'alerte — ce qui est pire que pas d'alerte du tout.

---

## 10. Fusionner deux dossiers, et défaire la fusion (EF-01-06)

**C'est l'opération la plus dangereuse de la plateforme.** Fusionner deux
personnes distinctes mélange leurs dossiers médicaux : l'allergie de l'une
devient celle de l'autre, et personne ne s'en aperçoit avant une prescription.
Tout ce que vous allez voir est construit autour de ce risque.

### D'abord, ce que l'accueil ne peut pas faire

Restez en **agent d'accueil** et rouvrez « Doublons possibles » sur Mamadou
Diallo. Il n'y a **aucun bouton pour fusionner** : vérifier une pièce est le
geste de celui qui reçoit le patient, mélanger deux dossiers ne l'est pas. On
lui dit à la place de signaler le doublon à l'administration de sa structure.

### Ensuite, la fusion

**Connectez-vous en `admin.donka@demo.test`** → **Identités et doublons**
(l'entrée est dans son propre menu).

> L'écran est le même que celui de l'accueil, mais le badge en haut dit
> « Admin Structure » : il annonce l'espace dans lequel vous êtes.

Ouvrez **« Doublons possibles »** sur Mamadou Diallo, puis **« Fusionner »** sur
Mamadou Dialo.

La boîte doit dire quatre choses, et vous devez les lire :

1. **ce qui va bouger** — consultations, vaccinations, rendez-vous, factures,
   contrats ;
2. **que le dossier absorbé n'est pas supprimé** : il garde son code QR, et une
   ancienne carte continue de fonctionner ;
3. **que le journal des accès n'est pas déplacé** — un accès au dossier absorbé
   reste un accès à ce dossier, le réécrire serait falsifier une trace ;
4. **comment se résout un désaccord de consentement** : le plus restrictif
   l'emporte.

**Essayez « Inverser »** : le sens de la fusion change. C'est voulu — vous seul
savez lequel des deux dossiers porte l'histoire la plus complète. La machine ne
le devine pas.

Le bouton reste inactif tant que le motif fait moins de dix caractères, et le
message vous dit quoi écrire. Validez.

Le message qui suit ne dit pas « opération réussie » : il dit **combien de
lignes ont bougé et dans quelle table** — « 2 · vaccinations · déplacées ». Un
agent ne croit pas une promesse, il lit une liste.

Mamadou Dialo **disparaît de la liste de travail**. Il n'est pas supprimé.

### Enfin, défaire

Sur la ligne de Mamadou Diallo, **« Fusions de ce dossier »**.

Vous voyez la fusion « En vigueur », avec **le motif que vous avez écrit** et
qui l'a faite. Cliquez **« Annuler cette fusion »**.

L'écran dit ce qui sera rendu, et ce qui ne le sera pas : *ce qui a été ajouté
au dossier conservé depuis la fusion y reste*. Un motif est exigé là aussi.

Après annulation, Mamadou Dialo **revient dans la liste**, avec ses deux
vaccinations.

> **Pourquoi « réversible » n'est pas un mot.** Chaque ligne déplacée est
> enregistrée dans une table dédiée. Annuler, c'est relire cette liste et
> rendre exactement ce qui a été bougé. C'est vérifié par comparaison contre
> une vraie base : `npx tsx scripts/prouver-fusion-reversible.mts` photographie
> les deux dossiers, fusionne, annule, et compare au caractère près.

### Les refus, qu'il faut essayer

| Ce que vous tentez | Ce qui doit arriver |
|---|---|
| Fusionner un dossier **avec lui-même** | Refusé |
| Un motif de moins de dix caractères | Refusé, avec une phrase qui dit quoi écrire |
| Fusionner un dossier **déjà fusionné** | Refusé : il n'y a pas de chaîne de fusion |
| Fusionner **deux identités vérifiées sur deux pièces différentes** | Refusé |

Le dernier est le plus important. Deux agents ont chacun vu une pièce, et les
numéros diffèrent : **ou bien ce sont deux personnes, ou bien une des deux
vérifications est fausse.** Une machine ne peut pas dire laquelle. C'est un
humain, pièce en main, qui doit trancher.

> Les trois premiers refus sont aussi tenus par la base elle-même — contraintes
> `CHECK` et déclencheur PostgreSQL — et pas seulement par le code qui appelle.

---

## 11. Le consentement versionné (EF-02-01/03/07)

**Connectez-vous en patiente** (`620100010` / `Pricemou1234`) →
**Mes consentements**.

### Ce que le versionnage rend visible

Chaque usage porte maintenant **le texte que vous avez accepté**. Cliquez
« Lire le texte » : il s'ouvre, avec son numéro de version et sa date.

Lisez-en un en entier. Chacun dit trois choses — ce qui est partagé, avec qui,
**et ce qui se passe si vous refusez**. Cette dernière phrase est la plus
importante : un consentement n'est libre que si refuser reste possible sans
conséquence sur les soins.

> Ces textes ne sont pas validés par un juriste. C'est une base de travail, et
> c'est précisément à cela que sert le versionnage : la version 2 viendra de
> cette relecture, sans effacer ce à quoi les gens ont déjà dit oui.

### « Accord présumé, jamais recueilli »

Sur cette patiente, deux usages portent un encadré orange :

> *Cet accord a été enregistré sans que personne ne vous montre de texte — à la
> création de votre dossier, ou avant que la plateforme ne conserve ce qui vous
> est présenté. **Ce n'est pas un consentement.***

C'est le cœur de ce bloc. Avant, ces deux lignes s'affichaient comme des
accords ordinaires. Dans la base, **deux des quatre consentements avaient été
posés par le système** à la création du dossier.

Cliquez **« Je confirme mon accord »** : le texte vous est alors réellement
opposé, et l'encadré disparaît.

### L'historique

En bas de la liste, **« Voir l'historique »**.

Vous y lisez vos décisions dans l'ordre, chacune avec la version du texte que
vous aviez sous les yeux. Et une phrase : *« Cette liste ne peut être ni
modifiée ni effacée, pas même par un administrateur. »*

> Ce n'est pas une formule. Deux déclencheurs PostgreSQL refusent `UPDATE`,
> `DELETE` et `TRUNCATE` sur cette table, comme pour le journal d'audit. Avant,
> un retrait écrasait l'accord : on voyait le refus d'aujourd'hui, jamais
> l'accord d'hier.

**Retirez un consentement, puis redonnez-le.** Les deux gestes apparaissent,
horodatés. Rien ne disparaît.

> Certaines lignes de l'historique portent la mention *« Vérification
> automatique de la plateforme, pas un geste du patient »* : ce sont mes
> propres appels de test du 2026-10-04. Elles ne peuvent pas être effacées —
> c'est le prix de l'inaltérabilité, et il est juste.

### La langue

La plateforme accepte le français, le pular et le malinké. **Seuls les textes
français existent.** Un patient dont le compte est en pular verra donc le texte
français, et l'écran le lui dira : *« Ce texte n'existe pas encore dans votre
langue. »*

Le manque se voit au lieu de se cacher — un texte en français montré à
quelqu'un qui lit le pular n'est pas un consentement éclairé.

### Ce que l'écran ne promet plus

La note en bas de la liste disait : *« Retirer un consentement prend effet
immédiatement pour les nouvelles demandes d'accès. »*

**C'était faux**, et c'est la trouvaille la plus sérieuse de ce bloc. Voir le
tableau ci-dessous.

---

## Ce que ce parcours ne couvre pas, et qu'il faut savoir

| Point | État |
|---|---|
| **Aucun compte `ADMIN_NATIONAL`** | Tous les écrans d'administration sont ouverts à `ADMIN_NATIONAL` **et** `SUPER_ADMIN`. Avec zéro compte national, toute l'administration repose sur un seul compte. |
| **Le consentement `DOSSIER_MEDICAL` ne commande rien** | **Le plus sérieux.** Seul l'export FHIR consulte réellement les consentements. L'accès au dossier par un soignant est décidé par la relation de soin — être suivi dans l'établissement, avoir un épisode en cours — sans jamais regarder cet interrupteur. Le patient croit commander un accès qu'il ne commande pas. L'écran ne l'affirme plus ; le raccorder demande le bris de glace (EF-02-06), sans quoi couper l'accès bloquerait des soins. |
| **Les textes de consentement** | Rédigés par moi, non relus par un juriste. Version 1, français seulement. Le pular et le malinké manquent. |
| **L'anonymisation RGPD** | Pas construite. Une demande d'effacement se traite à la main, et la réponse écrite dit ce qui a été fait. |
| **Les 15 comptes à moitié purgés** | Téléphone remplacé le 2026-08-04, **noms restés lisibles**, aucune trace de qui l'a fait. À trancher. |
| **La durée légale de conservation** d'un dossier de soins en Guinée | Inconnue de moi. Elle détermine ce qu'on peut répondre à une demande d'effacement. |
| **Les seuils de détection d'anomalies** | Non calibrés sur du trafic réel. Affichés à l'écran pour cette raison. |
| **Import de référentiels** | API seulement, pas d'écran. |
| **Fusion de deux doublons** (EF-01-06) | Construite le 2026-10-04, réversible, réservée à `ADMIN_STRUCTURE`. Voir l'étape 10. |
| **Le compte du dossier absorbé** | Il reste actif. La personne qui s'y connecte voit le dossier survivant — c'est la même personne — mais rien ne lui dit que ses deux dossiers ont été réunis. À trancher : faut-il le lui écrire ? |
| **Les poids de la détection de doublons** | Non calibrés sur du trafic réel : ils disent un ordre d'importance. La comparaison entre familles de traits reste arbitraire — un même nom de mère sans aucun nom commun (45) passe devant une variante d'orthographe avec téléphone partagé (42), alors que la seconde est plus probablement un doublon. Rien n'en découle, puisque aucun des deux ne conclut. |
| **Les dossiers « Diag Test », « roi dave », « ki ki », « de de »…** | 6 des 13 dossiers patients portent des noms de test. Ils faussent toute lecture des chiffres. À trancher avec le reste des données de démonstration. |

---

## Si quelque chose ne va pas

Notez **ce que vous faisiez, ce que vous attendiez, et ce que vous avez vu**. C'est le triplet qui permet de reproduire.

Les écrans sont vérifiés automatiquement dans les deux thèmes avant chaque livraison, mais une vérification automatique ne voit que ce qu'on lui a appris à regarder. Votre œil verra autre chose.

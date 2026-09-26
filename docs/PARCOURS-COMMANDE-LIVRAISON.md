# Parcours commande et livraison

> Processus décrit par le porteur du projet le **2026-09-26**. Il précise et corrige les blocs **P6** (commande pharmacie), **P7** (paiement), **P8** (livraison) et touche **P10** (assurance).
>
> Rien de ce qui suit n'est construit à ce jour. Ce document sert à ne pas perdre la décision, et à savoir ce qu'il reste à trancher avant d'écrire la première ligne.

---

## Le processus

### Déclencheur

L'épisode hospitalier est clôturé et **l'ordonnance est prête**. La plateforme doit alors savoir **dans quel quartier / commune** se trouve le patient — c'est de là que part tout le reste.

### 1. Appel aux pharmacies du quartier

Les **pharmacies partenaires du quartier** du patient sont notifiées et interrogées sur un point précis : **détenez-vous la totalité des produits ?**

### 2. Attribution — premier déclarant, premier servi

La **première** pharmacie qui déclare détenir tous les produits **prend la commande en charge**. Les autres sont écartées de ce tour.

Le **patient et le médecin** sont notifiés de la prise en charge.

> ⚠️ Technique : « premier déclarant » exige une attribution atomique. Deux pharmacies qui répondent à la même seconde ne doivent pas prendre la même commande.

### 3. Si aucune pharmacie n'a la totalité

Le **patient et le médecin sont avertis**. La décision revient au patient : prendre les produits disponibles et chercher les autres ailleurs, ou non.

> La délivrance ligne par ligne existe déjà (P3) : une ordonnance peut rester ouverte pour les produits non servis.

### 4. Le patient choisit le mode de remise

**Retrait en pharmacie** — le patient vient lui-même, parce qu'il habite à côté ou qu'il ne veut pas payer le transport. Il règle **en espèces, par mobile money, ou via son assurance maladie**.

**Livraison** — il paie **les médicaments avant le départ**, par **Orange Money ou via son assurance**. Le **transport** se règle séparément, au motard, à l'arrivée.

### 5. Livraison — les motards proposent leur prix

Les **motards du système présents dans les communes ou quartiers environnants** reçoivent la notification d'une course à faire — par exemple *de la pharmacie Nounie vers Kipé Prima Center*.

**Chaque motard fixe son prix.** Le patient reçoit les propositions et **choisit celle qui lui convient**. Ce n'est pas un tarif imposé par la plateforme : c'est le patient qui arbitre.

### 6. Attribution du motard et remise des produits

Dès que le patient valide un prix et un motard :

- la **pharmacie est notifiée** et reçoit les **informations du motard** : photo, numéro, identifiant sur la plateforme ;
- le motard se rend à la pharmacie ;
- à son arrivée, le pharmacien **scanne le QR code du motard**. S'il correspond, il lui remet les produits. Sinon, la course est relancée.

### 7. Suivi du trajet

Le **pharmacien** clique sur « livraison en cours », le **motard** également. Le **patient suit le trajet sur une carte** jusqu'à la remise.

### 8. À la livraison

Le patient déclare **« produit reçu »** dans l'application, devant le motard : c'est cette déclaration qui clôt la course.

Il règle alors **le transport** au motard, **en espèces ou par mobile money**. Les médicaments, eux, ont déjà été payés avant le départ.

---

## Ce que le modèle ne sait pas encore

Constaté dans `schema.prisma` le 2026-09-26.

| Manque | État actuel |
|---|---|
| **Quartier / commune** | Le patient a `prefecture`, `sousPrefecture`, `village` ; la structure a `prefecture` et `adresse`. **Aucun des deux n'a de quartier ni de commune**, qui est pourtant la maille de tout ce processus. |
| **Pharmacie partenaire** | `StructureSante` a un `type` et un `estActive`. La notion de **partenaire** (convention signée) n'existe pas — elle est prévue en P11 (EF-12-02). |
| **Coordonnées** | `latitude` / `longitude` existent sur le patient et sur la structure, mais sont **facultatives**. Un rayon géographique ne fonctionnera que si elles sont renseignées. |
| **Rôle livreur** | `LIVREUR` n'existe pas dans l'enum `Role`. |
| **Offre de course** | Rien : ni course, ni proposition de prix, ni attribution. |

---

## Règles tranchées (2026-09-26)

### Paiement — en deux temps, par deux canaux

| Quoi | Quand | Comment |
|---|---|---|
| **Les médicaments** | **Avant** le départ du motard | Orange Money, ou assurance sur justificatifs |
| **Le transport** | **À la remise**, au motard | Espèces ou mobile money |

Conséquence : le bloc paiement (P7) n'a **pas** à connaître la livraison. Le transport se règle de la main à la main, hors facture plateforme.

### Attribution de la commande — verrou exclusif, sans délai

**Aucun délai imposé** aux pharmacies. Dès qu'une pharmacie déclare détenir **tous** les produits, **les autres perdent l'accès à la validation** : la commande lui est attribuée.

Le verrou se **rouvre** si cette pharmacie se rétracte — si elle déclare finalement ne pas tout avoir, les autres retrouvent la main.

### Aucune pharmacie ne répond

Le patient **repart avec son ordonnance**, comme aujourd'hui, et cherche ses produits lui-même. La plateforme ne bloque rien : elle n'a simplement pas aidé sur ce cas.

### Aucun motard ne propose de prix

Le patient est **notifié** et peut aller chercher lui-même.

### Le motard choisi ne se présente pas — nouvel appel d'offres

**Au bout de 30 minutes**, la course repart en **appel d'offres complet**, pas en repêchage de l'offre suivante.

La raison : après une demi-heure, **le prix tient peut-être encore, le délai non**. Un motard qui annonçait « livrable dans 30 min » l'a dit il y a plus longtemps que cela ; il est ailleurs, ou sur une autre course. Reprendre son offre vendrait au patient un délai qui n'existe plus — et le délai fait la moitié du choix. Par ailleurs le patient avait retenu une **combinaison**, pas un prix : lui affecter d'office le suivant lui imposerait un marché qu'il n'a pas accepté.

Un appel d'offres complet ne veut pas dire repartir de zéro :

- **les précédents soumissionnaires sont re-notifiés en premier** — ils ont déjà montré leur intérêt et re-soumettent en un geste, avec un délai à jour. S'ils sont encore dans le secteur, le patient a une offre en quelques secondes ;
- **le motard défaillant est écarté de cette course** : il a accepté et n'est pas venu ;
- **le patient est prévenu, jamais contourné** — « votre livreur ne s'est pas présenté, nous relançons ». Un changement silencieux détruit la confiance plus vite qu'un retard ;
- **on lui propose la sortie** : après une demi-heure d'attente, on lui redemande s'il préfère aller chercher lui-même. C'est le principe de bout en bout — c'est le patient qui décide.

> **Les 30 minutes sont un paramètre système**, pas une constante. À Conakry, ce délai n'a pas le même sens à 8 h et à 15 h.

### Vérification du motard à la pharmacie — par QR code

Le motard **existe sur la plateforme et porte un QR code**. Le pharmacien le scanne à l'arrivée. Si la vérification échoue, **la course est relancée** pour un nouveau motard.

> Le QR remplace le contrôle à l'œil (photo, numéro) comme preuve d'identité : une machine ne se trompe pas de visage. La photo reste utile au pharmacien pour reconnaître la personne devant lui.

### Preuve de remise — déclarée par le patient

À la livraison, **le patient déclare « produit reçu » dans l'application, devant le motard**. C'est cette déclaration qui clôt la course, pas celle du motard.

> C'est la réponse à EF-10-06. Elle inverse la charge par rapport au code à usage unique : c'est le destinataire qui atteste, pas le livreur.

### Substitution — le pharmacien propose, le médecin décide

Le pharmacien **peut changer un produit, mais en accord avec le médecin traitant** : c'est lui qui connaît le patient. Le médecin dit le produit, la pharmacie délivre.

Le médecin est par ailleurs notifié à la prise en charge et en cas d'indisponibilité.

> EF-07-04 prévoyait la substitution par le pharmacien seul. Ici les deux interviennent, et l'ordre est clair : proposition d'un côté, décision de l'autre. Le circuit est décrit plus bas (proposition B).

### Assurance — vérifiée par la plateforme

C'est **la plateforme** qui contrôle, pas la pharmacie au comptoir. Le montage repose sur des **assurances partenaires conventionnées avec des pharmacies**, avec des **pourcentages définis à la convention**. Dès que le partenariat existe et que les taux sont posés, la prise en charge se calcule seule.

---

## Choix du motard — sur le délai *et* le prix

Le patient voit les deux : **« livrable dans 30 min — 10 000 GNF »**. Le motard annonce donc un **délai en plus de son prix**, et les deux engagent.

> Sans le délai, le choix se ferait au moins-disant. Dans une course de médicaments, une heure d'attente peut coûter plus cher que 2 000 GNF d'écart.

---

## Propositions à valider

Ces deux points ont été laissés ouverts avec la consigne de proposer une solution. Ce qui suit **attend votre validation** — le reste du document est décidé.

### A. Preuve de remise — deux voies, qui ne prouvent pas la même chose

On part du principe qu'un patient a un téléphone, ou quelqu'un pour l'assister. Il reste qu'un téléphone se décharge.

**Voie principale — le patient déclare.** Il ouvre l'application devant le motard et confirme « produit reçu ». C'est la preuve la plus forte : **le destinataire atteste**.

**Voie de secours — le motard scanne le QR du patient.** Le patient a déjà un QR code unique, celui qu'il présente au comptoir. Le motard le scanne, sur téléphone ou sur papier.

Ces deux voies **ne se valent pas**, et le système doit le dire :

| Voie | Ce qui est enregistré | Ce que ça prouve |
|---|---|---|
| Déclaration du patient | `CONFIRMEE_PATIENT` | Le destinataire a reçu et l'a dit |
| Scan du QR par le motard | `ATTESTEE_LIVREUR` | Le livreur était devant le QR du patient |

Le scan ne prouve pas la remise : un QR se photographie. Trois garde-fous, peu coûteux :

1. **Position et heure du scan** sont enregistrées et comparées à l'adresse de livraison. Un scan à trois kilomètres se voit.
2. Le patient reçoit une **notification** : « votre livraison a été déclarée remise ».
3. Il dispose d'un **délai pour contester** — 24 h, paramétrable. Sans contestation, la course est close.

> Le principe : celui qui atteste doit être celui qui a quelque chose à perdre s'il ment. Quand c'est le livreur qui atteste, on ajoute de quoi le vérifier.

### B. Substitution — la conversation où elle veut, la décision dans l'application

**La règle retenue** : le pharmacien peut changer un produit, **mais en accord avec le médecin traitant**, qui connaît le patient. Concrètement, le médecin dit le produit et la pharmacie délivre.

Le téléphone restera le canal réel — on ne va pas l'interdire. Mais **un appel ne laisse pas de trace**, et une substitution non tracée est exactement ce que EF-07-04 interdit.

**La proposition : l'appel prépare la décision, l'application l'enregistre.**

1. Le pharmacien ouvre une **demande de substitution** sur une ligne précise : produit proposé, motif (rupture, équivalent disponible).
2. Le **médecin prescripteur est notifié**. Sa vue porte le contexte : allergies du patient, autres lignes de l'ordonnance, et **les alertes recalculées sur le produit de remplacement** — `analyserPrescription` existe déjà et s'applique tel quel. Un substitut peut tomber sur une allergie que l'original évitait.
3. Le médecin **accepte ou refuse en un geste**. S'ils se sont parlé au téléphone, le geste ne fait qu'entériner ce qui est déjà dit — il prend trois secondes.
4. L'acceptation **réécrit la ligne** en conservant le produit d'origine visible : on doit pouvoir lire plus tard ce qui a été prescrit **et** ce qui a été délivré.
5. Le **patient est notifié** du changement.

**Ce qu'il faut encore trancher** : si le médecin ne répond pas — il est en consultation, de garde, injoignable. Trois options, par ordre de prudence :

- **la ligne attend**, et la commande part avec les autres produits (la délivrance partielle existe déjà) ;
- le pharmacien peut **relancer** ;
- au-delà d'un délai, l'**admin de structure** peut trancher à la place.

Ma recommandation : la première. Une substitution qui se décide toute seule faute de réponse n'est plus une substitution en accord avec le médecin.

---

## Conséquences sur le plan

- **P6** gagne l'appel aux pharmacies du quartier et l'attribution au premier déclarant — ce n'était pas prévu ainsi.
- **P8** n'est plus « un tarif annoncé au patient » mais **une mise en concurrence** où les motards proposent et le patient choisit. C'est un mécanisme sensiblement différent, plus proche d'une place de marché.
- **P11** (conventions des partenaires) devient un **préalable** à P6 : sans la notion de pharmacie partenaire, on ne sait pas qui notifier. Les conventions **assureur ↔ pharmacie**, avec leurs pourcentages, y entrent aussi — c'est de là que P10 tirera le calcul de prise en charge.
- **P7 (paiement) n'a pas à connaître la livraison** : le transport se règle de la main à la main au motard. Cela simplifie le bloc.
- Le **motard porte un QR code** sur la plateforme : c'est lui qui fait foi à la pharmacie, pas un contrôle à l'œil. Le **patient a déjà le sien** — il sert de voie de secours à la remise.
- L'**offre du motard porte un délai en plus du prix** : c'est sur les deux que le patient choisit.
- La **substitution réutilise `analyserPrescription`** : un produit de remplacement doit passer le même contrôle d'allergies et d'interactions qu'une prescription.
- Une **migration géographique** est nécessaire avant tout le reste : quartier et commune, sur le patient comme sur la structure.

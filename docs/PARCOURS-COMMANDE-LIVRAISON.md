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

### Le motard choisi ne se présente pas

**Au bout de 30 minutes**, la requête repart et la course est proposée à un autre motard.

### Vérification du motard à la pharmacie — par QR code

Le motard **existe sur la plateforme et porte un QR code**. Le pharmacien le scanne à l'arrivée. Si la vérification échoue, **la course est relancée** pour un nouveau motard.

> Le QR remplace le contrôle à l'œil (photo, numéro) comme preuve d'identité : une machine ne se trompe pas de visage. La photo reste utile au pharmacien pour reconnaître la personne devant lui.

### Preuve de remise — déclarée par le patient

À la livraison, **le patient déclare « produit reçu » dans l'application, devant le motard**. C'est cette déclaration qui clôt la course, pas celle du motard.

> C'est la réponse à EF-10-06. Elle inverse la charge par rapport au code à usage unique : c'est le destinataire qui atteste, pas le livreur.

### Le médecin — informé, et peut substituer

Il est notifié à la prise en charge et en cas d'indisponibilité. Il peut **proposer des produits du même type** : c'est lui le prescripteur.

> À noter : EF-07-04 prévoyait la substitution **par le pharmacien**. Ici elle revient au **médecin**. Les deux ne s'excluent pas, mais il faudra dire qui tranche en cas de désaccord.

### Assurance — vérifiée par la plateforme

C'est **la plateforme** qui contrôle, pas la pharmacie au comptoir. Le montage repose sur des **assurances partenaires conventionnées avec des pharmacies**, avec des **pourcentages définis à la convention**. Dès que le partenariat existe et que les taux sont posés, la prise en charge se calcule seule.

---

## Ce qui reste à trancher

### 1. Sur quoi le patient choisit-il son motard ?

**Sans réponse à ce jour.** Voit-il seulement les prix, ou aussi la **distance**, le **délai estimé**, une **note** du motard ?

Le prix seul pousse mécaniquement au moins-disant, ce qui n'est pas toujours le meilleur service — et dans une course de médicaments, le délai compte.

### 2. La relance à 30 minutes — nouvelle enchère ou offre suivante ?

Quand la course repart, **rejoue-t-on l'appel d'offres complet**, ou passe-t-on simplement au motard suivant parmi ceux qui avaient déjà proposé un prix ?

### 3. Le patient sans téléphone au moment de la remise

La preuve de remise repose sur une déclaration **dans l'application**. Si le patient n'a pas son téléphone, plus de batterie, ou ne sait pas s'en servir — que fait le motard ? Le cahier des charges prévoit aussi la **signature** (EF-10-06) : la garde-t-on en recours ?

### 4. Substitution : médecin ou pharmacien ?

Le médecin peut proposer un produit équivalent. Le pharmacien le peut aussi (EF-07-04). **Qui tranche** si les deux proposent, ou si le pharmacien n'a pas le produit substitué par le médecin ?

---

## Conséquences sur le plan

- **P6** gagne l'appel aux pharmacies du quartier et l'attribution au premier déclarant — ce n'était pas prévu ainsi.
- **P8** n'est plus « un tarif annoncé au patient » mais **une mise en concurrence** où les motards proposent et le patient choisit. C'est un mécanisme sensiblement différent, plus proche d'une place de marché.
- **P11** (conventions des partenaires) devient un **préalable** à P6 : sans la notion de pharmacie partenaire, on ne sait pas qui notifier. Les conventions **assureur ↔ pharmacie**, avec leurs pourcentages, y entrent aussi — c'est de là que P10 tirera le calcul de prise en charge.
- **P7 (paiement) n'a pas à connaître la livraison** : le transport se règle de la main à la main au motard. Cela simplifie le bloc.
- Le **motard porte un QR code** sur la plateforme : c'est lui qui fait foi à la pharmacie, pas un contrôle à l'œil.
- Une **migration géographique** est nécessaire avant tout le reste : quartier et commune, sur le patient comme sur la structure.

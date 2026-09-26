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

**Livraison** — il paie **avant la livraison**, par **Orange Money ou via son assurance**, en présentant les justificatifs.

### 5. Livraison — les motards proposent leur prix

Les **motards du système présents dans les communes ou quartiers environnants** reçoivent la notification d'une course à faire — par exemple *de la pharmacie Nounie vers Kipé Prima Center*.

**Chaque motard fixe son prix.** Le patient reçoit les propositions et **choisit celle qui lui convient**. Ce n'est pas un tarif imposé par la plateforme : c'est le patient qui arbitre.

### 6. Attribution du motard et remise des produits

Dès que le patient valide un prix et un motard :

- la **pharmacie est notifiée** et reçoit les **informations du motard** : photo, numéro, identifiant sur la plateforme ;
- le motard se rend à la pharmacie ;
- à son arrivée, le **pharmacien vérifie ces informations**. Si elles correspondent, il lui remet les produits.

### 7. Suivi du trajet

Le **pharmacien** clique sur « livraison en cours », le **motard** également. Le **patient suit le trajet sur une carte** jusqu'à la remise.

### 8. À la livraison

Le paiement est possible **par mobile money ou en espèces**.

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

## Questions ouvertes

Chacune change le code. Elles sont posées plutôt que tranchées d'office.

### 1. Le paiement — contradiction à lever

Le processus dit **« il paie avant la livraison »** (étape 4), puis **« à la livraison le paiement est possible par mobile money ou espèces »** (étape 8).

Lecture probable : les **médicaments** sont payés avant le départ, le **transport** est réglé au motard à l'arrivée. À confirmer — c'est la réponse qui décide si le bloc paiement doit connaître la livraison, ou l'ignorer.

### 2. Délai de réponse des pharmacies

Combien de temps laisse-t-on aux pharmacies pour répondre ? Et **si aucune ne répond** — ni oui, ni non — que devient la commande ? Sans délai, une commande peut rester suspendue indéfiniment.

### 3. Périmètre géographique

Si **aucune pharmacie partenaire n'est dans le quartier**, élargit-on au quartier voisin, à la commune, à la préfecture ? Et jusqu'où ? Même question pour les motards : « les communes environnantes » doit devenir un rayon en kilomètres, ou une liste de zones adjacentes tenue à la main.

### 4. Délai de proposition des motards

Combien de temps attend-on les offres ? Et **si aucun motard ne propose de prix**, la commande bascule-t-elle en retrait ?

### 5. Sur quoi le patient choisit-il ?

Le prix seul, ou voit-il aussi la **distance, le délai estimé, une note** du motard ? Le prix seul pousse mécaniquement vers le moins-disant, ce qui n'est pas toujours le meilleur service.

### 6. Le motard choisi ne vient pas

Après validation, s'il ne se présente jamais : au bout de combien de temps relance-t-on, et les autres motards sont-ils rappelés avec leurs prix initiaux ?

### 7. La vérification échoue à la pharmacie

Le pharmacien contrôle photo, numéro et identifiant. **Si cela ne correspond pas** : il refuse — et ensuite ? La course est annulée, réattribuée, signalée ?

### 8. Preuve de remise au patient

Le cahier des charges (EF-10-06) demande un **code à usage unique ou une signature** à la remise. Le processus décrit ne le mentionne pas. Le garde-t-on ? Sans preuve, « livré » n'est qu'une déclaration du motard.

### 9. Le rôle du médecin

Il est notifié à la prise en charge et en cas d'indisponibilité. **Est-ce pour information, ou doit-il pouvoir agir** — substituer un produit manquant, par exemple ? Cela change son écran.

### 10. Assurance : qui vérifie les justificatifs ?

« En présentant tous les documents nécessaires qui le prouvent » — **qui les contrôle, et quand** ? La pharmacie au comptoir, ou la plateforme avant validation ? Cette réponse relève de P10 et conditionne l'enchaînement.

---

## Conséquences sur le plan

- **P6** gagne l'appel aux pharmacies du quartier et l'attribution au premier déclarant — ce n'était pas prévu ainsi.
- **P8** n'est plus « un tarif annoncé au patient » mais **une mise en concurrence** où les motards proposent et le patient choisit. C'est un mécanisme sensiblement différent, plus proche d'une place de marché.
- **P11** (conventions des partenaires) devient un **préalable** à P6 : sans la notion de pharmacie partenaire, on ne sait pas qui notifier.
- Une **migration géographique** est nécessaire avant tout le reste : quartier et commune, sur le patient comme sur la structure.

# Feuille de route KÈNÈYA — mise en œuvre du cahier des charges v2.0

> Référence : *Cahier des charges Kènèya v2.0* du 13 septembre 2026 (exigences EF-01…EF-13, ENF-01…06, priorités M/S/C, lots V1→V4).
> Ce fichier est le plan de travail vivant : on coche au fur et à mesure, on renumérote jamais.
> Dernière mise à jour : 2026-09-19.

## Objectif produit

Le patient ne se déplace **qu'une fois** (à l'hôpital). Tout le reste se fait sur la plateforme : analyses, consultation, ordonnance, commande en pharmacie, prise en charge assurance, paiement, **livraison suivie sur une carte**. Annuaire des cliniques, pharmacies et laboratoires partenaires.

## Règles de travail

- **API d'abord, front ensuite, dans le même bloc** : chaque bloc API est mergé (develop → CI verte → `main`), puis **immédiatement branché au front avec ses écrans alignés sur le design de la landing** (couleurs, pilules, cartes, mode sombre), avant de passer au bloc suivant.
- **SMS et paiement restent simulés** (pas de clés API) derrière les abstractions existantes (`payment-provider.service`, `notification.service`). Seul le fournisseur changera plus tard.
- Les décisions D1–D10 du cahier des charges (règle de rejet assurance, base médicamenteuse, valeurs critiques, statut du livreur…) sont des **paramètres ou référentiels administrables**, jamais des constantes dans le code.
- Chaque livraison référence les exigences couvertes (ex. `EF-04-05`) dans le message de commit et dans Swagger.
- Chaque bloc = migration Prisma + services + routes + validateurs + tests Jest + Swagger + types partagés.

Tailles : **S** ≈ 1 jour · **M** ≈ 2–3 jours · **L** ≈ 4–6 jours.

## État de départ (gap analysis du 2026-09-18)

| Module | État | Existant | Manquant principal |
|---|---|---|---|
| EF-01 Identité | 🟡 | compte, OTP e-mail, 2FA (champ), reset, QR | OTP SMS, identito-vigilance, niveaux d'identité, doublons/fusion, n° d'ordre pro, 2FA imposé |
| EF-02 Consentement | 🟡 | 4 scopes, historique | versionnage du texte, granularité, bris de glace, journal des accès patient |
| EF-03 Hôpital | 🟠 | structures, référencement | épisode de soins, demande d'analyse structurée, orientation avec RDV |
| EF-04 Laboratoire | 🔴 | — | tout |
| EF-05 Médecin | 🟡 | RDV, consultation, ordonnance signée | n° unique + code, validité, statut servie, interactions/allergies |
| EF-06 Espace patient | 🟡 | dossier, QR, carnet, export | fil d'avancement, documents, assurance, aidants |
| EF-07 Pharmacie | 🟡 | scan, délivrance, stock | commande + machine à états, validation nominative, substitution, refus, partielle |
| EF-08 Paiement | 🟠 | facture, modes simulés | idempotence, attente/relance, remboursements, rapprochement |
| EF-09 Assurance | 🔴 | — | tout |
| EF-10 Livraison | 🔴 | lat/long patient | tout |
| EF-11 Notifications | 🟡 | in-app, e-mail, SMS simulé, USSD | contenu neutre, canaux, rejeu |
| EF-12 Admin/audit | 🟡 | comptes, structures, paramètres, journal | lectures de dossier, export, référentiels, RGPD |
| EF-13 Interop | 🟡 | OpenAPI, FHIR export | HL7 v2, LOINC/CIM-10/ATC, connecteur fichier, portail |

## Plan par ordre de priorité

### P0 — Identité de la plateforme (paramètres) · S · ✅ livré le 2026-09-19
- [x] Section `identite` dans `ParametresSysteme` : nom, slogan, logo (upload → URL), adresse, e-mails (contact, support, expéditeur), téléphones, site, réseaux sociaux, copyright, pays, devise.
- [x] `GET /parametres/publics` sans authentification (landing, pages d'auth, footer, titre d'onglet).
- [x] E-mails, SMS, USSD, Swagger, `/health` lisent la table (cache mémoire invalidé à la sauvegarde).
- [x] Plus aucune valeur de marque en dur dans le code (API et web).
- [x] Écran super-admin : section « Identité » avec téléversement du logo.

### P1 — Épisode de soins + demande d'analyse · M · EF-03 · ✅ livré le 2026-09-19 (API + front)
- [x] `EpisodeSoins` (motif, service, professionnel responsable, statut, dates), rattaché au patient. Rôle `AGENT_ACCUEIL`, espace web « Accueil hôpital ».
- [x] Recherche patient obligatoire avant création (EF-03-01).
- [x] Référentiel `Examen` avec codes LOINC (33 seedés ; import admin à venir avec P11).
- [x] `DemandeAnalyse` + lignes, urgence, laboratoire destinataire, consignes patient (à jeun…), transmission et notification (EF-03-03/04). Type de structure `LABORATOIRE`.
- [x] Orientation vers un médecin ou un service avec RDV proposé (EF-03-05).
- [x] Documents administratifs imprimables (EF-03-06) : bon d'examen HTML côté accueil et côté patient.
- [x] Tableau de bord établissement (EF-03-07). Côté patient : page « Mon parcours » (épisodes, analyses, rendez-vous, frise).

### P2 — Laboratoire · L · EF-04 · ✅ livré le 2026-09-19 (API + front)
- [x] Rôles `BIOLOGISTE` (validation) et `TECHNICIEN_LABO` (réception, prélèvement, saisie) ; type de structure `LABORATOIRE` (P1).
- [x] File des demandes triée par urgence puis ancienneté (EF-04-01) ; tableau de bord du laboratoire.
- [x] Prélèvement sur place ou à domicile avec créneau, patient notifié (EF-04-02) ; `Echantillon` codé `EC-AAAA-NNNNNN` (EF-04-03).
- [x] `ResultatAnalyse` : valeur, unité, références figées à la saisie, lecture NORMAL/ANORMAL/CRITIQUE calculée ; saisie par ligne ou import par code LOINC (EF-04-04/06).
- [x] Validation nominative du biologiste **bloquante** (toutes les lignes renseignées) avant toute diffusion (EF-04-05) ; compte rendu imprimable avec filigrane « NON VALIDÉ » avant validation.
- [x] Résultats critiques : seuils `critiqueMin/Max` par examen, alerte prioritaire au prescripteur avec accusé de lecture, escalade automatique vers l'admin de structure par job (30 min), diffusion patient différée jusqu'à l'accusé ou 24 h (EF-04-07/08/09).
- [x] Courbe d'évolution d'une valeur, côté patient et côté professionnel (EF-04-10).
- [ ] Saisie hors connexion via la sync existante (EF-04-11) — reporté : la sync ne couvre que l'ASC pour l'instant.
- [x] Front : espace « Laboratoire » (tableau de bord, file, fiche demande avec frise, planification, prélèvement, saisie, validation biologiste, compte rendu), page « Alertes critiques » côté accueil, résultats dans la fiche épisode et dans « Mon parcours », page « Mes résultats » (courbe SVG + tableau) côté patient.
- [ ] Médecin prescripteur : l'espace médecin n'émet pas encore de demandes d'analyse (seul l'accueil le fait) ; à brancher avec P3 (compte rendu de consultation).

### P3 — Ordonnance infalsifiable + sécurité de prescription · M · EF-05
- [x] **API livrée le 2026-09-23** — Numéro unique + code de vérification, durée de validité, statuts `PARTIELLEMENT_SERVIE`/`SERVIE`, vérification côté pharmacie (EF-05-07/08, EF-07-01).
  - L'ordonnance devient un **document** (`ordonnances`) et les médicaments ses **lignes** (`lignes_ordonnance`) : avant, trois médicaments prescrits le même jour formaient trois objets sans lien, donc rien à numéroter ni à contrôler.
  - Numérotation `OR-AAAA-NNNNNN` par le compteur atomique existant ; code de vérification tiré au CSPRNG sur un alphabet sans caractères ambigus (ni 0/O, ni 1/I/L).
  - Durée de validité et longueur du code = **paramètres système** (décision D2), administrables dans l'onglet « Ordonnances » du super-admin — jamais des constantes.
  - La validité court depuis la **signature**, pas la rédaction. Une ordonnance non signée est refusée au comptoir et absente de la file.
  - Délivrance **ligne par ligne** (prépare EF-07-07) ; le statut du document se déduit de ses lignes et ne se saisit jamais.
  - `POST /pharmacien/ordonnances/verifier` : numéro inconnu et code faux donnent la même réponse (pas d'énumération) ; un refus renvoie toujours son motif lisible.
  - Migration avec reprise des données existantes, vérifiée sur base jetable (5 documents reconstitués depuis 11 lignes, 13 contrôles, `migrate diff` vide).
- [x] **Front livré le 2026-09-23** : écran de vérification au comptoir (numéro + code, refus motivé affiché tel quel), page patient « Mes ordonnances » (code masqué par défaut, dévoilé d'un geste), ordonnance imprimable depuis l'espace patient comme depuis la fiche de consultation.
  - Le document est rendu par l'API, comme le bon d'examen et le compte rendu de laboratoire : filigrane « NON SIGNÉE » ou « EXPIRÉE » pour qu'aucun papier n'ait l'air opposable sans l'être.
  - Parcours e2e étendu : la patiente retrouve son ordonnance, dévoile son code et l'imprime, avant que la pharmacie ne la délivre.
- [x] **API livrée le 2026-09-23** — Base médicaments enrichie (`codeAtc`, `contreIndications`) ; `InteractionMedicament` ; alertes non bloquantes avec motif de dépassement (EF-05-05/06).
  - Trois familles d'alertes : **allergies** déclarées au dossier (directes et **par famille ATC** — un patient allergique à l'amoxicilline l'est à toute la classe J01C), **contre-indications** face aux maladies chroniques, **interactions** avec les traitements encore en cours.
  - Les libellés étant saisis à la main, la comparaison est insensible aux accents et à la casse, avec un seuil de 4 caractères : sans lui, « fer » se rapprocherait de « fermeture » et les alertes deviendraient du bruit.
  - **Rien n'est bloqué** : le prescripteur voit le patient, le référentiel voit une paire de molécules. `POST /consultations/:id/ordonnances/alertes` renvoie ce qu'il doit savoir ; `motifRequis` n'est vrai qu'au-delà de la simple précaution, pour ne pas provoquer des « RAS » systématiques.
  - Les alertes sont **recalculées côté serveur** à la prescription (sauter l'appel ne les contourne pas) et **figées sur la ligne** avec le motif : le référentiel évoluera, ce qui compte est ce qui a été montré ce jour-là. La traçabilité du motif est en outre assurée par le journal d'audit, qui enregistre déjà le corps de chaque POST.
  - ⚠️ **Le référentiel d'interactions est vide** : aucune donnée clinique n'a été inventée. Les alertes allergies et contre-indications fonctionnent dès maintenant depuis le dossier patient ; les interactions attendent l'import du référentiel (P11, décision D6).
- [x] **Front livré le 2026-09-23** : les alertes s'affichent dès le choix du médicament (pas à l'enregistrement — savoir après avoir rédigé la posologie n'aide personne), triées par gravité et colorées sur les tokens sémantiques (contre-indication → danger, déconseillée → warning, précaution → info), donc justes en clair comme en sombre. Le champ « motif de dépassement » n'apparaît qu'au-delà de la simple précaution, et le seuil vient de l'API.
  - Une analyse indisponible le dit au lieu de laisser croire que le dossier est sans particularité.
  - Parcours e2e étendu : la patiente du jeu d'essai est déclarée allergique à l'amoxicilline ; choisir cette molécule fait apparaître l'alerte et le motif, en changer les efface.
- [x] **API + front livrés le 2026-09-25** — Ordonnances renouvelables (EF-05-09) ; circuit distinct pour produits réglementés (EF-05-12).
  - **Renouvellement** : le numéro et le code **ne changent pas** d'un cycle à l'autre — c'est le même papier que le patient représente au comptoir. Les lignes repassent en attente, le compteur avance, et la validité globale continue de plafonner : un renouvellement ne prolonge pas une ordonnance périmée. Déclenché depuis la pharmacie, qui a le patient devant elle, et seulement sur une ordonnance entièrement servie.
  - **Produits réglementés** : `Medicament.estReglemente`. Une ordonnance qui en contient n'est jamais renouvelable, voit sa validité réduite (paramètre distinct, 28 jours par défaut) et **exige la signature d'un médecin quelle que soit la décision D2** — un stupéfiant ne se délivre pas sur la parole d'un agent communautaire.
  - Ces règles sont appliquées **au niveau du document**, après chaque prescription : le prescripteur ne peut pas s'y soustraire en les ignorant.
  - Front : champ « renouvellements » verrouillé dès qu'un produit réglementé entre dans l'ordonnance, bandeau au comptoir imposant le contrôle d'identité, bouton « Renouveler », et compteur de cycles restants côté patient.
  - Les deux durées et le plafond de renouvellements sont des **paramètres administrables** dans l'onglet « Ordonnances » du super-admin.
- [ ] Compte rendu de consultation structuré, daté, signé (EF-05-03).

### P4 — Identité patient, consentement, accès · L · EF-01 / EF-02
- [ ] Champs identito-vigilance (lieu de naissance, nom de la mère), identifiant définitif.
- [ ] Niveaux d'identité `PROVISOIRE` / `VERIFIEE` et verrou tiers payant / produits sur prescription (EF-01-04/10).
- [ ] Détection de doublons à la création et fusion par agent habilité, réversible (EF-01-05/06).
- [ ] Vérification du numéro d'ordre avant activation d'un compte pro (EF-01-08) ; 2FA imposée aux pros (EF-01-07).
- [ ] Consentement versionné avec le texte présenté, granularité pro/document, retrait immédiat (EF-02-01/03/05/07).
- [ ] Bris de glace motivé, tracé, notifié, contrôlé (EF-02-06).
- [ ] Journal des accès au dossier consultable par le patient (EF-02-08).

### P5 — Fil d'avancement du parcours · S · EF-06
- [ ] Endpoint patient agrégeant épisode → analyses → consultation → ordonnance → commande → livraison avec horodatages (EF-06-01).
- [ ] Tous les documents téléchargeables/imprimables (EF-06-02/03).
- [ ] Déclaration des informations d'assurance (EF-06-04).

### P6 — Commande pharmacie · L · EF-07 / §3.2
- [ ] **Mode de remise choisi par le patient à la commande** (décision du 2026-09-26) : `RETRAIT_PHARMACIE` ou `LIVRAISON`. Ce n'est pas un repli technique — beaucoup de patients habitent à côté d'une pharmacie et iront chercher eux-mêmes. La livraison n'est jamais imposée.
- [ ] `Commande` + lignes ; machine à états stricte, avec **deux sorties selon le mode** :
  - commun : Créée → Validée pharmacie → Prise en charge en cours → À payer → Payée → En préparation
  - retrait : → **Prête pour retrait** → Retirée → Clôturée
  - livraison : → **Frais de transport proposés** → **Acceptés par le patient** → Livreur notifié → En livraison → Livrée → Clôturée
  - (+ Échec, Annulée/Remboursée)
- [ ] Panier chiffré ligne par ligne depuis l'ordonnance (EF-07-02).
- [ ] Validation nominative obligatoire du pharmacien (EF-07-03) ; substitution tracée et notifiée (EF-07-04) ; refus motivé (EF-07-05).
- [ ] Stock temps réel + pharmacie alternative (EF-07-06) ; délivrance partielle (EF-07-07) ; pas de retour (EF-07-11).
- [ ] Historique et renouvellement (EF-07-09).

### P7 — Paiement fiable (fournisseur simulé) · M · EF-08
- [ ] `TentativePaiement` avec référence unique → idempotence (EF-08-03).
- [ ] Statuts en attente et job de vérification répétée (EF-08-04).
- [ ] Détail du calcul avant paiement (EF-08-01) ; reçu et facture téléchargeables (EF-08-06).
- [ ] Remboursements totaux/partiels motivés (EF-08-07) ; rapprochement quotidien avec signalement des écarts (EF-08-08).
- [ ] Aucune donnée de carte stockée (EF-08-05).

### P8 — Livraison + carte + annuaire · L · EF-10
- [ ] Rôle `LIVREUR` ; `OrdreLivraison` créé après paiement et préparation (EF-10-01).
- [ ] Adresse avec points de repère, instructions, position GPS (EF-10-02) ; créneaux (EF-10-03).
- [ ] Affectation au livreur ; positions horodatées pour le **suivi du trajet** (EF-10-04/05).
- [ ] Preuve de remise : code à usage unique ou signature (EF-10-06) ; contrôle d'identité produits sensibles (EF-10-07).
- [ ] Échec : nouvelle tentative, retour pharmacie, remboursement (EF-10-08) ; chaîne du froid (EF-10-09) ; signalement colis (EF-10-10).
- [ ] **Frais de transport annoncés avant engagement** (décision du 2026-09-26) : la plateforme propose un montant (ex. « Transport 5 000 GNF — acceptez-vous ? »). **Aucun livreur n'est notifié tant que le patient n'a pas accepté.** Le montant vient d'un référentiel administrable, jamais d'une constante.
- [ ] Sur acceptation : notification aux livreurs, prise de course, puis suivi.
- [ ] Le retrait en pharmacie n'est **pas un repli** : c'est un mode de remise permanent, à égalité avec la livraison.
- [ ] Annuaire public géolocalisé : cliniques, pharmacies, laboratoires (horaires, services, coordonnées).

### P9 — Notifications neutres · S · EF-11
- [ ] Aucun contenu médical dans un message sortant (EF-11-02) ; SMS en repli (EF-11-03).
- [ ] Préférences de canaux et de langue (EF-11-04) ; rejeu des non délivrées (EF-11-05).

### P10 — Assurance et tiers payant · L · EF-09
- [ ] `Assureur`, `ContratAssurance`, bénéficiaires, date d'effet (EF-09-01).
- [ ] Taux par acte/analyse/produit avec date d'effet ; plafonds, franchises, exclusions, carence (EF-09-03/04).
- [ ] Calcul du reste à charge ligne par ligne (ENF-04-08).
- [ ] Autorisation préalable bloquante au-delà d'un seuil paramétrable (EF-09-05).
- [ ] Trois modes : API, portail assureur, validation manuelle (EF-09-02) ; dossier de facturation et suivi (EF-09-06/07).
- [ ] Règle de rejet après délivrance en paramètre (EF-09-08, décision D4) ; non assurés en paiement direct (EF-09-09).

### P11 — Administration, audit, référentiels · M · EF-12
- [ ] Journal non modifiable incluant les **lectures** de dossier ; recherche et export (EF-12-04/05).
- [ ] Suspension immédiate d'un compte (EF-12-01) ; conventions des partenaires (EF-12-02).
- [ ] Référentiels importables : LOINC, CIM-10, ATC, tarifs, taux, zones de livraison (EF-12-03).
- [ ] Demandes RGPD : accès, rectification, effacement, portabilité (EF-12-09).
- [ ] Détection d'anomalies d'accès (EF-12-06).

### P12 — Interopérabilité · L · EF-13
- [ ] HL7 v2 en réception (EF-13-03) ; ressources FHIR R4 étendues (EF-13-02).
- [ ] Connecteur fichier CSV/XML (EF-13-05) ; portail de saisie manuelle (EF-13-06).
- [ ] Journal et rejeu des échanges externes (EF-13-07) ; environnement de test partenaires (EF-13-08).

### P13 — Extension (lot V4) · L
- [ ] Comptes aidants avec mandat et périmètre (EF-06-05) ; mineurs (EF-06-06).
- [ ] Rappels de prise de traitement (EF-06-09) ; code d'urgence (EF-06-08).
- [ ] Téléconsultation (EF-05-10/11) ; statistiques anonymisées (EF-12-08).

## Du point où nous en sommes à la mise en service

> Section ajoutée le 2026-09-25. Elle ne remplace pas le plan par blocs ci-dessus : elle le met en perspective jusqu'à la livraison, avec ce qui n'est pas du code et ce qui bloque en dehors de l'équipe.

### Où nous en sommes

Livrés et en production sur `main` : **P0** (identité de la plateforme), **P1** (épisode de soins, demande d'analyse), **P2** (laboratoire), et **P3 aux trois quarts** (ordonnance infalsifiable, sécurité de prescription, renouvellement et produits réglementés). Reste P3 : le compte rendu de consultation.

Filet de sécurité en place : 261 tests API, 21 tests front, 5 parcours end-to-end, CI à cinq jobs sur chaque poussée.

### Les phases, dans l'ordre

Les tailles (**S** ≈ 1 j · **M** ≈ 2–3 j · **L** ≈ 4–6 j) sont de l'**effort de développement pour une personne**. Elles n'incluent ni la recette, ni les décisions externes, ni l'installation chez l'hébergeur. Le calendrier réel dépend surtout de ces trois-là, pas du code.

#### Phase 1 — Socle médical (lot V1) · ~12–18 j

Ce qui rend la plateforme utilisable en établissement, sans commerce ni assurance.

| Bloc | Objet | Taille | Bloqué par |
|---|---|---|---|
| P3 (fin) | Compte rendu de consultation structuré, daté, signé (EF-05-03) — débloque aussi le médecin prescripteur d'analyses, reliquat de P2 | M | — |
| P4 | Identito-vigilance, doublons, consentement versionné, bris de glace, journal des accès | L | — |
| P5 | Fil d'avancement du parcours patient, documents téléchargeables | S | — |
| P9 | Notifications sans contenu médical, préférences de canal, rejeu | S | — |
| P11 | Journal d'audit des **lectures**, référentiels importables, demandes RGPD | M | — |

**P11 conditionne le reste** : c'est lui qui apporte l'import des référentiels (LOINC, CIM-10, ATC, tarifs). Sans lui, le référentiel d'interactions médicamenteuses reste vide et le catalogue de médicaments ne se gère qu'en base.

À l'issue de cette phase, le lot V1 du cahier des charges est couvert : **recette possible sur le parcours médical**.

#### Phase 2 — Commerce (lot V2) · ~7–10 j

| Bloc | Objet | Taille | Bloqué par |
|---|---|---|---|
| P6 | Commande pharmacie + machine à états, substitution, refus motivé, délivrance partielle | L | — |
| P7 | Paiement idempotent, statuts en attente, remboursements, rapprochement | M | **D8** (grille tarifaire) |

Le fournisseur de paiement reste **simulé** derrière `payment-provider.service` : passer en réel ne demandera qu'un adaptateur, pas une refonte.

#### Phase 3 — Assurance et livraison (lot V3) · ~10–14 j

| Bloc | Objet | Taille | Bloqué par |
|---|---|---|---|
| P10 | Assureurs, contrats, taux, plafonds, reste à charge, autorisation préalable | L | **D4** (rejet après délivrance) |
| P8 | Livraison, rôle livreur, suivi GPS, preuve de remise, annuaire géolocalisé | L | **D1/D5** (livraison à domicile, statut du livreur) |

P8 est **constructible sans D1/D5** grâce au repli « retrait en pharmacie » déjà prévu : la carte et le suivi se branchent ensuite.

#### Phase 4 — Interopérabilité · ~4–6 j

P12 : HL7 v2 en réception, FHIR R4 étendu, connecteur fichier, environnement de test partenaires. Cette phase **dépend des partenaires**, pas de nous : elle ne peut pas être finie sans un interlocuteur en face.

#### Phase 5 — Extension (lot V4) · ~4–6 j

P13 : comptes aidants, mineurs, rappels de traitement, téléconsultation (**D2**), statistiques anonymisées. Hors périmètre d'une première mise en service.

### Dette à solder avant la mise en service

Constatée et vérifiée le 2026-09-25. Rien ici n'est bloquant pour développer, tout l'est pour livrer sereinement.

| Point | Constat | Effort |
|---|---|---|
| `apps/api/prisma.config.js` | Artefact de build **commité** à côté du `.ts`. Prisma le préfère et fait échouer les commandes sans `--config` explicite. | S |
| Swagger | **2 routes pharmacien documentées sur 12.** Le CDC impose que chaque livraison référence ses exigences dans Swagger. | S |
| CI | `actions/checkout@v4` et `setup-node@v4` ciblent Node 20, déprécié. Avertissement aujourd'hui, panne demain. | S |
| Redis | `REDIS_URL` non configuré : la limitation de débit est **en mémoire**, donc inopérante dès qu'il y a plus d'une instance. | S |
| E-mail | Gmail non configuré : l'OTP tombe en repli développement. Inacceptable en production. | S |
| Référentiels | Interactions médicamenteuses **vides** (aucune donnée clinique inventée), catalogue médicaments non administrable depuis l'interface. | résolu par P11 |
| Sync hors connexion | Ne couvre que l'ASC. Le laboratoire (EF-04-11) l'attend. | M |

### Ce qui n'est pas du code

C'est ici que se joue la date de mise en service, bien plus que dans les blocs P.

1. **Décisions externes** — six décisions du CDC conditionnent des blocs entiers : D1/D5 (livraison, statut du livreur), D2 (ordonnance numérique, téléconsultation), D4 (rejet d'assurance), D6 (base médicamenteuse), D7 (valeurs critiques), D8 (grille tarifaire). Toutes sont déjà des **paramètres ou référentiels administrables** : les trancher ne demandera pas de développement, seulement une saisie.
2. **Hébergement agréé santé** (ENF-05) — agrément, localisation des données, coffre de clés (ENF-01-03), séparation dev/test/prod (ENF-01-09). Délai administratif, à lancer **au plus tôt**.
3. **Sauvegardes et restauration** (ENF-02) — RPO 15 min, RTO 4 h, **testées chaque trimestre**. Une sauvegarde jamais restaurée n'est pas une sauvegarde.
4. **Test d'intrusion** (ENF-01-07) — avant mise en service, par un tiers.
5. **Supervision et alertes** (ENF-06-03).
6. **Reprise de données** — patients, structures, professionnels existants. Volume et qualité inconnus à ce jour : à chiffrer dès que les fichiers sources sont disponibles.
7. **Recette** — le CDC est la référence contractuelle : chaque EF/ENF doit être vérifié par le client, pas par l'équipe.
8. **Formation et accompagnement** — ASC, agents d'accueil, laboratoires, pharmaciens. Ce sont des métiers différents, pas un public unique.

### Jalons proposés

| Jalon | Contenu | Condition de sortie |
|---|---|---|
| **J1 — Socle médical recettable** | Fin de phase 1 + dette « avant mise en service » | Le parcours hôpital → labo → ordonnance → pharmacie se déroule de bout en bout sur données réelles anonymisées |
| **J2 — Pilote en site unique** | J1 + hébergement + reprise de données + formation d'un établissement | Un établissement utilise la plateforme en conditions réelles |
| **J3 — Commerce et paiement** | Phase 2, fournisseur de paiement réel | Une commande est payée et délivrée |
| **J4 — Ouverture** | Phase 3 + test d'intrusion + sauvegardes testées | Mise en service élargie |
| **J5 — Interopérabilité** | Phase 4, au rythme des partenaires | Échange réel avec un système tiers |

**Le chemin critique n'est pas le code.** L'agrément de l'hébergeur et la reprise de données sont les deux éléments à lancer immédiatement, en parallèle du développement — ils ne s'accélèrent pas en écrivant plus vite.

## Questions ouvertes sur la livraison (à trancher avant P6/P8)

Le principe est acquis — le patient choisit, et accepte les frais avant qu'un livreur soit notifié. Six points restent sans réponse, et chacun change le code :

1. **Comment le montant est-il calculé ?** Forfait par zone, distance, ou saisi par la pharmacie ? Quelle que soit la réponse, ce sera un **référentiel administrable** (règle de travail du projet), mais sa forme dépend du mode de calcul.
2. **Qui encaisse le transport ?** Ajouté à la facture réglée sur la plateforme, ou payé en espèces au livreur à la remise ? La réponse décide si P7 (paiement) doit connaître la livraison.
3. **Si le patient refuse le montant**, la commande bascule-t-elle en retrait en pharmacie, ou est-elle annulée ?
4. **Si aucun livreur n'accepte** dans un délai donné : quel délai, et que devient la commande ?
5. **Le patient peut-il revenir sur son choix** après avoir accepté les frais, et jusqu'à quand ?
6. **Le montant annoncé est-il ferme ?** Un écart constaté à la livraison ouvrirait une négociation au pas de la porte, que la plateforme ne saurait pas arbitrer.

## Hors code — exploitation (à traiter avec l'hébergeur)

Hébergeur agréé santé et localisation des données (ENF-05), sauvegardes RPO 15 min / RTO 4 h testées chaque trimestre (ENF-02), coffre de clés (ENF-01-03), supervision et alertes (ENF-06-03), test d'intrusion avant mise en service (ENF-01-07), séparation dev/test/prod (ENF-01-09).

## Décisions externes en attente (annexe 15.2 du CDC)

| # | Décision | Impact sur le code |
|---|---|---|
| D1/D5 | Livraison de médicaments à domicile, statut du livreur | **Partiellement tranché le 2026-09-26** : la livraison est facultative, le patient choisit, et il accepte les frais avant qu'un livreur soit notifié. Restent ouvertes les questions ci-dessous. |
| D2 | Cadre de l'ordonnance numérique et téléconsultation | P3 (validité, signature), P13 |
| D4 | Qui supporte un rejet d'assurance après livraison | paramètre système (P10) |
| D6 | Base médicamenteuse de référence | référentiel importable (P3) |
| D7 | Liste des valeurs biologiques critiques | référentiel paramétrable (P2) |
| D8 | Modèle économique et grille tarifaire | référentiel tarifs (P11) |

## Journal d'avancement

| Date | Bloc | Commit / note |
|---|---|---|
| 2026-09-25 | P3 | Renouvellement et produits réglementés (EF-05-09, EF-05-12), API + interfaces. 261 tests API, 5 parcours e2e. Deux signatures rendues obligatoires dans `motifDeRefus` pour que le compilateur force les appelants : sans cela les deux règles restaient inertes. |
| 2026-09-23 | P3 | Front sécurité de prescription : alertes affichées au choix du médicament, triées par gravité, motif de dépassement exigé au-delà de la précaution. Jeu e2e enrichi d'une allergie déclarée pour vérifier que l'alerte arrive bien à l'écran. |
| 2026-09-23 | P3 | API sécurité de prescription (EF-05-05/06) : allergies (dont par famille ATC), contre-indications, interactions ; alertes non bloquantes, recalculées côté serveur et figées sur la ligne avec le motif de dépassement. 243 tests API. Référentiel d'interactions volontairement vide — aucune donnée clinique inventée. |
| 2026-09-23 | P3 | Front : vérification au comptoir (numéro + code), page patient « Mes ordonnances » avec code masqué, ordonnance imprimable. 220 tests API, 5 parcours e2e. La signature obligatoire devient le paramètre de la décision D2, à `false` : imposer un médecin bloquerait la délivrance là où il n'y en a pas. |
| 2026-09-23 | P3 | API : l'ordonnance devient un document numéroté, codé, daté et signé ; délivrance ligne par ligne ; vérification au comptoir (EF-05-07/08, EF-07-01). Migration avec reprise des données, vérifiée sur base jetable. |
| 2026-09-18 | — | Renommage KÈNÈYA, landing et pages d'auth refaites, plan validé |
| 2026-09-19 | P2 | API `5b2e945` + front : espace Laboratoire (technicien, biologiste), cycle réception → prélèvement → saisie → validation, résultats critiques avec accusé et escalade, courbes d'évolution patient |
| 2026-09-19 | Design | `37646f0` : tous les espaces (patient, ASC, médecin, pharmacien, admin structure) alignés sur la landing en clair et sombre — en-têtes `.bb-page-head`, cartes de chiffres neutres, alias `.bb-*` partagés |
| 2026-09-19 | P1 | API `05f61d8` + front : espace Accueil hôpital (tableau de bord, admission, épisodes, orientation, demande d'analyse, bon d'examen), page patient « Mon parcours », rôle agent d'accueil et type laboratoire dans l'admin, locale fr pour les dates |
| 2026-09-19 | P0 | API `c5c1772` + web : identité de la plateforme administrable (nom, logo, coordonnées), `<app-brand>`, `PlateformeService` |

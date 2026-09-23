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
- [ ] **Front P3 à faire** : écran de vérification au comptoir (saisie numéro + code), impression de l'ordonnance avec son numéro et son code, affichage du code côté patient.
- [ ] Base médicaments enrichie (DCI, ATC) ; `InteractionMedicament` ; alertes interactions/allergies/contre-indications non bloquantes avec motif de dépassement (EF-05-05/06).
- [ ] Ordonnances renouvelables (EF-05-09) ; circuit distinct pour produits réglementés (EF-05-12).
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
- [ ] `Commande` + lignes ; machine à états stricte : Créée → Validée pharmacie → Prise en charge en cours → À payer → Payée → En préparation → En livraison → Livrée → Clôturée (+ Échec, Annulée/Remboursée).
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
- [ ] Repli « retrait en pharmacie » tant que D1/D5 ne sont pas tranchées.
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

## Hors code — exploitation (à traiter avec l'hébergeur)

Hébergeur agréé santé et localisation des données (ENF-05), sauvegardes RPO 15 min / RTO 4 h testées chaque trimestre (ENF-02), coffre de clés (ENF-01-03), supervision et alertes (ENF-06-03), test d'intrusion avant mise en service (ENF-01-07), séparation dev/test/prod (ENF-01-09).

## Décisions externes en attente (annexe 15.2 du CDC)

| # | Décision | Impact sur le code |
|---|---|---|
| D1/D5 | Livraison de médicaments à domicile, statut du livreur | P8 construit avec repli retrait en pharmacie |
| D2 | Cadre de l'ordonnance numérique et téléconsultation | P3 (validité, signature), P13 |
| D4 | Qui supporte un rejet d'assurance après livraison | paramètre système (P10) |
| D6 | Base médicamenteuse de référence | référentiel importable (P3) |
| D7 | Liste des valeurs biologiques critiques | référentiel paramétrable (P2) |
| D8 | Modèle économique et grille tarifaire | référentiel tarifs (P11) |

## Journal d'avancement

| Date | Bloc | Commit / note |
|---|---|---|
| 2026-09-23 | P3 | API : l'ordonnance devient un document numéroté, codé, daté et signé ; délivrance ligne par ligne ; vérification au comptoir (EF-05-07/08, EF-07-01). 202 tests API (+51). Écrans de vérification et d'impression restent à faire. |
| 2026-09-18 | — | Renommage KÈNÈYA, landing et pages d'auth refaites, plan validé |
| 2026-09-19 | P2 | API `5b2e945` + front : espace Laboratoire (technicien, biologiste), cycle réception → prélèvement → saisie → validation, résultats critiques avec accusé et escalade, courbes d'évolution patient |
| 2026-09-19 | Design | `37646f0` : tous les espaces (patient, ASC, médecin, pharmacien, admin structure) alignés sur la landing en clair et sombre — en-têtes `.bb-page-head`, cartes de chiffres neutres, alias `.bb-*` partagés |
| 2026-09-19 | P1 | API `05f61d8` + front : espace Accueil hôpital (tableau de bord, admission, épisodes, orientation, demande d'analyse, bon d'examen), page patient « Mon parcours », rôle agent d'accueil et type laboratoire dans l'admin, locale fr pour les dates |
| 2026-09-19 | P0 | API `c5c1772` + web : identité de la plateforme administrable (nom, logo, coordonnées), `<app-brand>`, `PlateformeService` |

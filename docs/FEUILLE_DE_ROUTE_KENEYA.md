# Feuille de route KÈNÈYA — mise en œuvre du cahier des charges v2.0

> Référence : *Cahier des charges Kènèya v2.0* du 13 septembre 2026 (exigences EF-01…EF-13, ENF-01…06, priorités M/S/C, lots V1→V4).
> Ce fichier est le plan de travail vivant : on coche au fur et à mesure, on renumérote jamais.
> Dernière mise à jour : **2026-10-02**.
>
> ⚠️ **Un addendum du 2026-09-28** (`ADDENDUM-CDC-2026-09-28.md`) ajoute huit points remontés par le chef de projet, dont **trois rouvraient du code livré** : le médecin fixe désormais les rendez-vous, le rôle biologiste disparaît, et les résultats d'analyse ne sont visibles du patient qu'après accord du médecin. **Six des huit blocs sont livrés** ; les blocs concernés portent la mention **🔁 rouvert**.
>
> ⚠️ Tout ce qui est coché ci-dessous est sur **`develop`**. La branche `main` s'arrête au **2026-09-26** et ne contient aucun bloc de l'addendum.

## Où nous en sommes — recompté le 2026-10-02

Les cases de ce fichier, comptées à la main le 2026-10-02. `[~]` note un bloc livré en partie.

| Bloc | Fait | Partiel | Reste | État |
|---|---|---|---|---|
| **P0** Identité de la plateforme | 5 | — | 0 | ✅ **fini** |
| **P1** Épisode de soins + demande d'analyse | 11 | — | 0 | ✅ **fini** (🔁 repris puis complété) |
| **P2** Laboratoire | 11 | — | 1 | ⏳ reste la synchronisation hors connexion (EF-04-11) |
| **P3** Ordonnance + sécurité de prescription | 5 | — | 1 | ⏳ |
| **P4** Identité patient, consentement, accès | 0 | — | 7 | ❌ **non commencé** — le plus sensible réglementairement |
| **P5** Fil d'avancement du parcours | 0 | — | 3 | ❌ non commencé |
| **P6** Commande pharmacie et gestion d'officine | 5 | 1 | 7 | ⏳ lots, approvisionnement, péremptions, **vente au comptoir et tableau de bord** livrés ; restent les écrans de commande, l'import Excel et l'OCR |
| **P7** Paiement | 0 | — | 5 | ❌ non commencé |
| **P8** Livraison, carte, annuaire | 0 | — | 9 | ❌ non commencé |
| **P9** Notifications neutres | 1 | — | 1 | ⏳ **la neutralité est livrée le 02/10** — c'était un défaut en service, pas une case vide. Restent les préférences de canaux et le rejeu |
| **P10** Assurance et tiers payant | 3 | 4 | 2 | ⏳ **livré le 02/10, API + caisse** : assureur, contrat, règles par catégorie, éligibilité tracée, reste à charge ligne par ligne affiché avant paiement. Restent la vue assureur, l'administration des assureurs à l'écran et les échanges automatiques |
| **P11** Administration, audit, référentiels | 5 | 1 | — | ⏳ **référentiels, journal d'audit, suspension de compte et détection d'anomalies livrés le 03/10** (API, Swagger et écrans). La chaîne est complète : on détecte, on enquête, on suspend. Restent les conventions des partenaires (EF-12-02) et le RGPD (EF-12-09) |
| **P12** Interopérabilité | 0 | — | 3 | ❌ non commencé |
| **P13** Extension (lot V4) | 1 | — | 4 | ⏳ prise de RDV à distance livrée ; téléconsultation suspendue à D2 |
| **Total** | **42** | **5** | **48** | sur 95 |

**Deux blocs sont réellement finis : P0 et P1.** P2 et P3 n'ont plus qu'une case chacun.

### Ce qui a été livré hors feuille de route, et qui compte

| Date | Objet | Pourquoi ça ne figure dans aucune case |
|---|---|---|
| 2026-09-26 | Écran « Orientations » du médecin | L'accueil orientait un patient : l'épisode recevait son responsable, mais **rien ne le disait au médecin**. L'orientation écrivait dans le vide. |
| 2026-09-26 | « Serveur injoignable » ≠ « identifiants incorrects » | La page de connexion accusait le mot de passe quand l'API était éteinte. |
| 2026-10-01 | **Catégorie de produit fermée** (`CategorieProduit`) | Préalable aux blocs 7 et 8 de l'addendum. Le catalogue accepte des articles non médicamenteux ; une contrainte SQL garantit qu'un médicament porte DCI, forme et dosage. |
| 2026-10-01 | Garde-fou d'invariant dans les semences | Une quantité de stock sans lot est **indélivrable** depuis les lots. Les deux semences le vérifient en terminant. |
| 2026-09-30 → 10-02 | Trois correctifs de sécurité amont | `engine.io`, `brace-expansion`, `nodemailer`, `@angular/router`, et une exception datée pour `piscina`. |

### Le chemin critique n'est pas le code

L'agrément de l'hébergeur de données de santé (ENF-05) et la reprise des données commandent la date de mise en service. Ils ne s'accélèrent pas en écrivant plus vite : **à lancer en parallèle, maintenant**. Six décisions externes (D1, D2, D4, D5, D6, D7, D8) conditionnent des blocs entiers ; toutes sont déjà des paramètres, les trancher ne demande aucun développement.

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

### P1 — Épisode de soins + demande d'analyse · M · EF-03 · ✅ **complet** (livré le 2026-09-19, 🔁 repris et complété le 2026-09-30)
- [x] `EpisodeSoins` (motif, service, professionnel responsable, statut, dates), rattaché au patient. Rôle `AGENT_ACCUEIL`, espace web « Accueil hôpital ».
- [x] Recherche patient obligatoire avant création (EF-03-01).
- [x] Référentiel `Examen` avec codes LOINC (33 seedés ; import admin à venir avec P11).
- [x] `DemandeAnalyse` + lignes, urgence, laboratoire destinataire, consignes patient (à jeun…), transmission et notification (EF-03-03/04). Type de structure `LABORATOIRE`.
- [x] Orientation vers un médecin ou un service avec RDV proposé (EF-03-05).
- [x] ✅ **Livré le 2026-09-30 (API + front)** — l'accueil n'est plus celui qui fixe le créneau : il oriente, **le médecin fixe le rendez-vous** (addendum, point 3). Le champ date disparaît de l'écran d'accueil.
- [x] ✅ **Livré le 2026-09-30** — **Agenda du médecin** (addendum, point 8) : ses rendez-vous **par ordre chronologique**, le plus proche en premier, groupés par jour, avec l'état de présence. Aucun écran de ce genre n'existe, mais l'index `@@index([idMedecin, prevuLe])` est déjà en base — il ne manque que l'endpoint et l'écran. Se livre avec la reprise ci-dessus : un médecin qui fixe ses rendez-vous a besoin de l'endroit où les voir.
- [x] ✅ **Fermé le 2026-09-30** — `RendezVous.statut` était une **chaîne libre** (`String @default("PLANIFIE")`) : à fermer en `enum` au moment où le pointage y ajoute ses états, la base n'interdisant aujourd'hui aucune valeur.
- [x] ✅ **Livré le 2026-09-30 (API + front)** — **Pointage de présence** (addendum, point 2) : file des patients attendus du jour, arrivée pointée par l'assistante, redirection vers le médecin au bon moment. Le rôle reste `AGENT_ACCUEIL`, dont l'intitulé affiché devient « Assistante ».
- [x] Documents administratifs imprimables (EF-03-06) : bon d'examen HTML côté accueil et côté patient.
- [x] Tableau de bord établissement (EF-03-07). Côté patient : page « Mon parcours » (épisodes, analyses, rendez-vous, frise).

### P2 — Laboratoire · L · EF-04 · ⏳ **11 cases sur 12** (livré le 2026-09-19, 🔁 repris les 28 et 30/09) — reste la synchronisation hors connexion
- [x] Rôles `BIOLOGISTE` (validation) et `TECHNICIEN_LABO` (réception, prélèvement, saisie) ; type de structure `LABORATOIRE` (P1).
- [x] ✅ **Livré le 2026-09-30** — **le rôle `BIOLOGISTE` est supprimé** : c'est le laborantin (`TECHNICIEN_LABO`) qui valide (addendum, point 4). La validation nominative **reste bloquante** — quelqu'un continue de signer. Migration des comptes existants obligatoire ; les comptes rendus déjà validés gardent le nom de leur valideur.
- [x] File des demandes triée par urgence puis ancienneté (EF-04-01) ; tableau de bord du laboratoire.
- [x] Prélèvement sur place ou à domicile avec créneau, patient notifié (EF-04-02) ; `Echantillon` codé `EC-AAAA-NNNNNN` (EF-04-03).
- [x] `ResultatAnalyse` : valeur, unité, références figées à la saisie, lecture NORMAL/ANORMAL/CRITIQUE calculée ; saisie par ligne ou import par code LOINC (EF-04-04/06).
- [x] Validation nominative du biologiste **bloquante** (toutes les lignes renseignées) avant toute diffusion (EF-04-05) ; compte rendu imprimable avec filigrane « NON VALIDÉ » avant validation.
- [x] Résultats critiques : seuils `critiqueMin/Max` par examen, alerte prioritaire au prescripteur avec accusé de lecture, escalade automatique vers l'admin de structure par job (30 min), diffusion patient différée jusqu'à l'accusé ou 24 h (EF-04-07/08/09).
- [x] Courbe d'évolution d'une valeur, côté patient et côté professionnel (EF-04-10).
- [x] ✅ **Livré le 2026-09-28 (API + front)** — **le patient ne voit un résultat qu'après que le médecin l'a libéré**, avec la possibilité d'y joindre une explication en langage clair (addendum, point 7). Aujourd'hui un résultat non critique part au patient dès la validation du laboratoire, et un résultat critique finit par partir tout seul au bout de 24 h : **cette diffusion automatique disparaît**. Un garde-fou relance le médecin puis escalade vers l'admin de structure — jamais vers le patient.
- [ ] Saisie hors connexion via la sync existante (EF-04-11) — reporté : la sync ne couvre que l'ASC pour l'instant.
- [x] Front : espace « Laboratoire » (tableau de bord, file, fiche demande avec frise, planification, prélèvement, saisie, validation biologiste, compte rendu), page « Alertes critiques » côté accueil, résultats dans la fiche épisode et dans « Mon parcours », page « Mes résultats » (courbe SVG + tableau) côté patient.
- [x] ✅ **Livré le 2026-09-29** — Médecin prescripteur : écran « Dossier de la visite » côté médecin (analyses de l'épisode, prescription, clôture). L'API l'autorisait déjà ; c'est l'écran qui manquait. Dans le même mouvement, l'accueil perd prescription, lecture de résultats, bon d'examen, clôture et envoi aux pharmacies (addendum, point 9). Les valeurs d'analyse sont masquées dans la fiche d'épisode qu'il continue de voir : fermer les routes ne suffisait pas.

### P3 — Ordonnance infalsifiable + sécurité de prescription · M · EF-05 · ⏳ **5 cases sur 6**
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
  - ⚠️ **Le référentiel d'interactions est vide** : aucune donnée clinique n'a été inventée. Les alertes allergies et contre-indications fonctionnent dès maintenant depuis le dossier patient. L'import qui permet de le remplir est livré depuis le 03/10 (EF-12-03) et vérifié de bout en bout : ce qui manque est **la source médicale validée**, pas l'outil (décision D6).
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

### P4 — Identité patient, consentement, accès · L · EF-01 / EF-02 · ❌ **0 sur 7 — non commencé**
- [ ] Champs identito-vigilance (lieu de naissance, nom de la mère), identifiant définitif.
- [ ] Niveaux d'identité `PROVISOIRE` / `VERIFIEE` et verrou tiers payant / produits sur prescription (EF-01-04/10).
- [ ] Détection de doublons à la création et fusion par agent habilité, réversible (EF-01-05/06).
- [ ] Vérification du numéro d'ordre avant activation d'un compte pro (EF-01-08) ; 2FA imposée aux pros (EF-01-07).
- [ ] Consentement versionné avec le texte présenté, granularité pro/document, retrait immédiat (EF-02-01/03/05/07).
- [ ] Bris de glace motivé, tracé, notifié, contrôlé (EF-02-06).
- [ ] Journal des accès au dossier consultable par le patient (EF-02-08).

### P5 — Fil d'avancement du parcours · S · EF-06 · ❌ **0 sur 3**
- [ ] Endpoint patient agrégeant épisode → analyses → consultation → ordonnance → commande → livraison avec horodatages (EF-06-01).
- [ ] Tous les documents téléchargeables/imprimables (EF-06-02/03).
- [ ] Déclaration des informations d'assurance (EF-06-04).

### P6 — Commande pharmacie **et gestion d'officine** · L · EF-07 / §3.2 · ⏳ **5 faites + 1 partielle sur 13**

> **Élargi le 2026-09-28** (addendum, point 1) : il ne s'agit plus seulement de servir des ordonnances, mais de **tenir une pharmacie**. S'ajoutent la vente au comptoir, l'import Excel du catalogue, l'approvisionnement par facture et les alertes de péremption.
>
> ⚠️ **Un blocage de modèle est à lever d'abord.** `Stock` porte `@@unique([idStructure, idMedicament])` et **une seule** `datePeremption` : deux lots du même produit périmant à deux dates différentes ne tiennent pas dedans, alors que c'est exactement ce que produit un approvisionnement. Il faut un modèle `LotStock`, `Stock` devenant la somme de ses lots. Migration avec reprise.
>
> De même, la **vente au comptoir n'existe pas**. `Facture` ne sait pas dire **ce qui** a été vendu : elle n'a qu'un `montantGnf`, aucune ligne. Elle exige aussi un `idPatient`, donc un client de passage sans dossier ne peut pas être facturé. Elle ne porte ni vendeur, ni remise, ni établissement. (`idConsultation` est `String?`, donc une facture sans consultation est déjà possible — le verrou n'est pas là.) Sans lignes, il n'y a rien à totaliser dans un tableau de bord.

> **Socle livré le 2026-09-26 (API)** : géographie (`commune`, `quartier` sur le patient et la structure), `StructureSante.estPartenaire`, rôle `LIVREUR`, modèles `Commande` et `ReponsePharmacie`, appel au quartier et **attribution atomique**. Le front reste à faire.
>
> L'attribution repose sur un `updateMany` conditionnel : deux pharmacies simultanées donnent un gagnant et un perdant, jamais deux gagnants. Vérifié par sabotage.

- [x] **API livrée le 2026-09-26** — **Appel aux pharmacies du quartier** dès l'ordonnance prête : les pharmacies partenaires sont interrogées sur la disponibilité **de la totalité** des produits ; **la première qui déclare les avoir prend la commande**. Patient et médecin notifiés. Si aucune n'a tout, les deux sont avertis et le patient décide (voir `PARCOURS-COMMANDE-LIVRAISON.md`).
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
- [x] **API + front livrés le 2026-09-30** — **`LotStock`** : quantité, date de péremption, facture d'origine, prix d'achat. Sortie au plus proche de la péremption (`consommerLots`), et délivrance d'un lot périmé bloquée. `Stock.datePeremption` a disparu ; `Stock.quantite` est la somme de ses lots.
- [x] **API + front livres le 2026-10-02** — **Vente au comptoir** : modeles `VenteComptoir` et `LigneVente`, panier, remise plafonnee par parametre, mode de paiement, vendeur, client **facultatif** (un passant n'a pas de dossier), ordonnance exigee pour un produit reglemente (EF-05-12) — l'ecran le dit **avant** d'encaisser — et verifiee par les memes regles qu'au guichet. Sortie de stock par `consommerLots`. Annulation d'une erreur de saisie qui remet **exactement** les lots sortis ; ce n'est pas un retour client (EF-07-11). **Reste le volet assurance, qui depend de P10.**
- [x] **API + front livres le 2026-10-02** — **Tableau de bord officine** : chiffre du jour depuis minuit, panier moyen, encaissements par moyen de paiement, dix produits les plus vendus sur trente jours, ruptures et lots a perimer. Les ventes annulees sont exclues de tous les agregats.
- [ ] **Import Excel du catalogue**, avec rapport ligne par ligne — un import qui échoue en silence sur trois lignes est pire que pas d'import.
- [~] **Approvisionnement par facture** — **premier temps livré le 2026-09-30 (API + front)** : saisie assistée, une ligne par lot avec sa propre péremption, facture attachée en justificatif, total recalculé à la frappe. **Reste l'extraction automatique**, qui devra **toujours** être relue avant enregistrement : une erreur d'OCR sur une quantité ou une péremption ne doit jamais entrer seule en stock.
- [x] **API + front livrés le 2026-09-30** — **Alerte de péremption proche**, seuil paramétrable (`STOCK_PEREMPTION_ALERTE_JOURS`, 90 par défaut) et horizon choisi à l'écran (30/60/90/180). Les lots déjà périmés sont présentés à part : ils sont à retirer, pas à surveiller.

### P7 — Paiement fiable (fournisseur simulé) · M · EF-08 · ❌ **0 sur 5**
- [ ] `TentativePaiement` avec référence unique → idempotence (EF-08-03).
- [ ] Statuts en attente et job de vérification répétée (EF-08-04).
- [ ] Détail du calcul avant paiement (EF-08-01) ; reçu et facture téléchargeables (EF-08-06).
- [ ] Remboursements totaux/partiels motivés (EF-08-07) ; rapprochement quotidien avec signalement des écarts (EF-08-08).
- [ ] Aucune donnée de carte stockée (EF-08-05).

### P8 — Livraison + carte + annuaire · L · EF-10 · ❌ **0 sur 9**
- [ ] Rôle `LIVREUR` ; `OrdreLivraison` créé après paiement et préparation (EF-10-01).
- [ ] Adresse avec points de repère, instructions, position GPS (EF-10-02) ; créneaux (EF-10-03).
- [ ] Affectation au livreur ; positions horodatées pour le **suivi du trajet** (EF-10-04/05).
- [ ] Preuve de remise : code à usage unique ou signature (EF-10-06) ; contrôle d'identité produits sensibles (EF-10-07).
- [ ] Échec : nouvelle tentative, retour pharmacie, remboursement (EF-10-08) ; chaîne du froid (EF-10-09) ; signalement colis (EF-10-10).
- [ ] **Mise en concurrence des motards** (processus du 2026-09-26, voir `PARCOURS-COMMANDE-LIVRAISON.md`) : les motards des communes environnantes sont notifiés de la course, **chacun propose son prix**, et **le patient choisit**. La plateforme n'impose pas de tarif.
- [ ] Sur validation : la pharmacie reçoit **photo, numéro et identifiant** du motard, et **vérifie à son arrivée** avant de remettre les produits.
- [ ] Le retrait en pharmacie n'est **pas un repli** : c'est un mode de remise permanent, à égalité avec la livraison.
- [ ] Annuaire public géolocalisé : cliniques, pharmacies, laboratoires (horaires, services, coordonnées).

### P9 — Notifications neutres · S · EF-11 · ⏳ **1 sur 2**
- [x] **API livrée le 2026-10-02** — **aucun contenu médical dans un message sortant** (EF-11-02). Ce n'était pas une case vide mais un **défaut en service** : le code envoyait « des analyses vous attendent », « prélèvement prévu », « vos résultats d'analyses sont disponibles », « RESULTAT CRITIQUE », « votre vaccination BCG est due ». Le contrôle vit au **point de sortie** des SMS, donc un site d'appel oublié ne peut pas fuir ; des constructeurs nommés produisent les messages. Hors production le refus **lève** ; en production il remplace par un message neutre et journalise. Un message tapé par un administrateur est refusé en **400** avec le mot fautif. SMS en repli (EF-11-03) : reste à faire.
- [ ] Préférences de canaux et de langue (EF-11-04) ; rejeu des non délivrées (EF-11-05).

### P10 — Assurance et tiers payant · L · EF-09 · ⏳ **3 faites + 4 partielles sur 9** — livré le 2026-10-02 (API + caisse) ; restent la vue assureur et l'administration des assureurs à l'écran
- [~] **API livrée le 2026-10-02** — `Assureur` (code, mode d'échange, structure de type `ASSURANCE`) et `ContratAssurance` (police, taux de base, plafond annuel, franchise, date d'effet, date de fin, carence). **Reste les bénéficiaires** : un contrat couvre aujourd'hui un seul patient, pas ses ayants droit.
- [~] **API livrée le 2026-10-02** — taux **par catégorie de produit** avec date d'effet, plafond par ligne, plafond annuel, franchise, carence. `RegleCouverture` ne remplace jamais la précédente : sa date d'effet décide, et le calcul retient celle en vigueur à la date de la vente. **Reste les taux par acte et par analyse**, qui supposent un référentiel d'actes (P11).
- [x] **API + front livrés le 2026-10-02** — calcul du reste à charge **ligne par ligne**, fonction pure et testée pour elle-même. Le détail s'additionne exactement à la part de l'assureur, franchise et plafonds compris : sinon l'écran afficherait une somme qui ne tombe pas juste. La caisse l'affiche **avant** l'encaissement.
- [ ] Autorisation préalable bloquante au-delà d'un seuil paramétrable (EF-09-05).
- [ ] Trois modes : API, portail assureur, validation manuelle (EF-09-02) — `Assureur.modeEchange` existe, **seul `MANUEL` fonctionne** ; dossier de facturation et suivi (EF-09-06/07).
- [~] Non assurés en **paiement direct** : acquis, une vente sans `avecAssurance` est intégralement payée par le client (EF-09-09). **Reste la règle de rejet après délivrance** (EF-09-08, décision D4).
- [~] **API + front livrés le 2026-10-02** — contrôle d'éligibilité **opposable et tracé** : le patient se reconnaît par son QR au comptoir, la réponse est figée en base, jamais recalculée, et un refus porte toujours son motif (contrainte SQL). **Reste la vue de l'assureur sur ses pharmacies conventionnées** (délivré, facturé, payé, dû, écarts) — elle suppose un suivi de règlement qui n'existe pas encore.
- [x] **API livrée le 2026-10-02** — **exclusions par catégorie de produit**. Les deux préalables ont été levés le 2026-10-01 : le catalogue accepte des articles non médicamenteux, et `CategorieProduit` est une énumération fermée. Une catégorie exclue n'a pas de taux : porter les deux serait contradictoire, et une contrainte SQL le refuse.
- [x] **API + front livrés le 2026-10-02** — **un taux de 100 % ne couvre pas tout**. Vérifié à l'écran : un assuré à 100 % chez qui le lait est exclu voit « Total 47 000 · Pris par l'assureur − 2 000 · À encaisser 45 000 », et la ligne de lait porte « Catégorie LAIT_INFANTILE exclue par l'assureur ». Le détail est montré **avant** paiement, avec les notes disant ce qui a raboté la part de l'assureur.

### P11 — Administration, audit, référentiels · M · EF-12 · ⏳ **5 sur 5** (EF-12-02 et EF-12-09 restent)
- [~] **API livrée le 03/10** — **journal non modifiable incluant les lectures** (EF-12-04). Trois constats en éprouvant la table :
  - l'**ajout seul existait déjà**, depuis la migration du 2026-06-19 : un déclencheur refuse `UPDATE` et `DELETE`. Cette case était comptée comme non commencée à tort ;
  - **mais `TRUNCATE` n'était pas couvert.** Ce déclencheur est `FOR EACH ROW`, et `TRUNCATE` ne déclenche jamais un déclencheur de ligne : `TRUNCATE journal_audit` vidait le journal entier sans obstacle. Fermé par un déclencheur d'instruction ;
  - la colonne `ressource` était **fausse en service** : Express tronque `req.path` du préfixe de montage, et le code y cherchait le segment `v1`. D'où 288 lignes de ressource « me » et 120 « unknown » dans la base de démonstration.
  - **Limite assumée** : le propriétaire de la table peut supprimer ou désactiver un déclencheur. Une inviolabilité complète suppose des droits restreints au niveau du SGBD, voire un stockage en écriture unique.
  - **Reste sur EF-12-04** : rien. La recherche et l'export (EF-12-05) sont livrés le même jour, voir ci-dessous.
- [x] **API, Swagger et écran livrés le 03/10** — **recherche et export du journal** (EF-12-05). `/admin/journal` : période, rôle, ressource, patient, auteur, refus seulement, et export CSV.
  - **La recherche est elle-même journalisée.** Sans cela, le seul endroit d'où l'on voit tout serait le seul qu'on ne verrait pas. L'écran le dit à l'opérateur plutôt que de le lui cacher.
  - **Un export trop large est refusé, jamais tronqué en silence** (limite 10 000 lignes, le message donne le nombre exact). Un journal d'audit amputé sans le dire est pire qu'un export absent : on conclut d'une absence de ligne qu'il ne s'est rien passé. L'écran prévient avant le clic.
  - **Sans date de début, la recherche ne remonte pas au-delà de 30 jours** : le journal est la table qui grandit le plus vite.
  - Deux fautes trouvées contre l'API réelle, pas par les tests : un critère mal orthographié passait en silence (le routeur recopiait les critères à la main, court-circuitant `.strict()`), et un rôle inconnu rendait 500 au lieu de 400.
  - Au passage, l'**export d'analytics** joignait ses champs sur une virgule sans échappement : « Fièvre, toux » décalait toutes les colonnes suivantes, et le fichier s'ouvrait quand même. Il passe par le même générateur CSV, qui échappe, pose le BOM et sépare par des points-virgules.
- [~] **API, Swagger et écran livrés le 03/10** — **suspension immédiate d'un compte** (EF-12-01). `/admin/comptes`, réservé à `ADMIN_NATIONAL` et `SUPER_ADMIN` ; un admin de structure disposait déjà de `desactiverAgent`, borné à ses propres agents.
  - **Le trou comblé** : un socket n'est authentifié qu'à la poignée de main. Un compte suspendu continuait de recevoir les notifications de ses patients jusqu'à ce qu'il ferme son navigateur, alors que la moindre requête HTTP lui était refusée dans la seconde. Vérifié contre l'API : « 33 session(s) et 1 connexion(s) temps réel coupées ».
  - « Immédiate » engage donc **trois portes** : `estActif = false` relu à chaque requête, sessions supprimées, sockets fermés — avec un événement `session:revoquee` avant la coupure, sinon le navigateur se contente de réessayer.
  - **Qui, quand, pourquoi** : trois colonnes, et une contrainte SQL qui refuse qu'elles se contredisent. Le motif fait au moins dix caractères. La contrainte tolère les 15 comptes fermés par l'ancienne voie, sans motif connu, et l'écran les distingue d'une suspension documentée.
  - **Garde-fous** : soi-même, un compte déjà fermé, un `SUPER_ADMIN` quand on n'en est pas un, et **le dernier super administrateur actif** — la base de démonstration n'en porte qu'un, le suspendre laisserait la plateforme sans administration.
- [ ] **Conventions des partenaires** (EF-12-02) — ni modèle ni écran.
- [x] **API livrée le 2026-10-03** — **référentiels importables par CSV** (EF-12-03) : examens LOINC, interactions médicamenteuses, catalogue produits. `POST /api/v1/referentiels/{type}/import`, réservé à `ADMIN_NATIONAL` et `SUPER_ADMIN` — une règle d'interaction erronée se traduirait en alerte fausse, ou absente, chez chaque prescripteur.
  - **`simulation: true` valide tout et n'écrit rien** : c'est ce qu'on lance avant un import réel.
  - Le rapport porte **une ligne par ligne du fichier** avec son verdict (`CREEE`, `MISE_A_JOUR`, `REFUSEE`) et le motif de chaque refus. Les lignes valides passent malgré un refus : rejeter deux mille bonnes lignes pour trois mauvaises serait pire, mais rien n'est silencieux.
  - Format réel d'Excel en français : séparateur `;` ou `,` déduit de l'en-tête, guillemets avec échappement par doublement, champs sur plusieurs lignes, CRLF, BOM, lignes vides.
  - Les paires de DCI sont **normalisées et triées** avant écriture, parce que la détection d'interaction normalise et trie ses arguments : sans cela la règle serait en base et l'alerte ne sortirait jamais. Vérifié en rejouant la requête de la détection après un import réel.
  - **Le numéro de ligne rendu est celui du tableur de l'opérateur**, lignes vides et champs multilignes compris. La première version numérotait par position dans le tableau après filtrage : une seule ligne vide et l'opérateur était renvoyé à la ligne précédant la fautive, donc il corrigeait une ligne saine. Trouvé en interrogeant l'API réelle, pas par les 40 tests unitaires. Six sabotages verrouillent la correction.
  - **Reste à faire** : CIM-10, ATC, zones de livraison, tarifs par acte et par analyse — et un écran d'administration ; aujourd'hui l'import se fait par l'API.
- [ ] Demandes RGPD : accès, rectification, effacement, portabilité (EF-12-09).
- [x] **API, Swagger et écran livrés le 03/10** — **détection d'anomalies d'accès** (EF-12-06). `GET /journal/anomalies`, et un encart en tête de `/admin/journal` d'où chaque signal mène au détail.
  - **Ce sont des signaux à examiner, pas des verdicts.** Un soignant de garde consulte beaucoup de dossiers sans rien faire de mal ; un comptoir de pharmacie scanne des dizaines de codes par jour. Un détecteur qui trancherait ferait suspendre des gens à tort. L'écran le dit, en toutes lettres.
  - **Trois détecteurs** : refus répétés (**seuls 401 et 403** — un 400 est une requête mal formée, pas une porte forcée), dossiers **distincts** touchés, et adresses IP multiples. Ce dernier ne monte jamais en alerte : un soignant qui passe du wifi au téléphone le déclenche.
  - **Les seuils ne sont pas calibrés** sur du trafic réel et devront probablement varier selon le rôle. C'est écrit dans le code, dans Swagger, dans un test qui les fixe, et **affiché à l'écran**.
  - Vérifié en **provoquant** l'anomalie : seize tentatives refusées sur le journal d'audit, puis l'écran ouvert. « Alerte — David Camara (Médecin) s'est vu refuser l'accès 41 fois, pour un seuil de 5 », et le clic sur « Voir le détail » a rendu les lignes correspondantes.

### P12 — Interopérabilité · L · EF-13 · ❌ **0 sur 3**
- [ ] HL7 v2 en réception (EF-13-03) ; ressources FHIR R4 étendues (EF-13-02).
- [ ] Connecteur fichier CSV/XML (EF-13-05) ; portail de saisie manuelle (EF-13-06).
- [ ] Journal et rejeu des échanges externes (EF-13-07) ; environnement de test partenaires (EF-13-08).

### P13 — Extension (lot V4) · L · ⏳ **1 sur 5**
- [ ] Comptes aidants avec mandat et périmètre (EF-06-05) ; mineurs (EF-06-06).
- [ ] Rappels de prise de traitement (EF-06-09) ; code d'urgence (EF-06-08).
- [x] ✅ **Livré le 2026-09-30 (API + front)** — **Prise de rendez-vous à distance** (addendum, point 6) : le patient demande sa consultation depuis chez lui, le médecin fixe le créneau, l'assistante le pointe à son arrivée. Se construit avec le circuit RDV ci-dessus.
- [ ] **Téléconsultation réelle (EF-05-10/11)** — visioconférence, acte à distance : **reste en lot V4**, décision du chef de projet (« on verra un peu plus tard »), et toujours suspendue à **D2**. Elle s'appuiera sur le circuit de prise de rendez-vous à distance : on ne consulte pas à distance quelqu'un qui n'a pas pu prendre rendez-vous à distance.
- [ ] Statistiques anonymisées (EF-12-08).

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

**Le verrou P11 est partiellement levé** (03/10) : l'import CSV existe pour les examens, les interactions et le catalogue produits. Le référentiel d'interactions **reste vide en base** — aucune donnée clinique n'a été inventée — mais il est désormais remplissable sans toucher au SQL. Restent à couvrir par l'import : CIM-10, ATC, tarifs par acte et par analyse, zones de livraison.

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
| Swagger | **2 routes pharmacien documentées sur 10.** Le CDC impose que chaque livraison référence ses exigences dans Swagger. | S |
| CI | `actions/checkout@v4` et `setup-node@v4` ciblent Node 20, déprécié. Avertissement aujourd'hui, panne demain. | S |
| Redis | `REDIS_URL` non configuré : la limitation de débit est **en mémoire**, donc inopérante dès qu'il y a plus d'une instance. | S |
| E-mail | Gmail non configuré : l'OTP tombe en repli développement. Inacceptable en production. | S |
| Référentiels | Interactions médicamenteuses **vides** en base : aucune donnée clinique n'a été inventée, et il faut une source médicale validée pour les remplir. L'import existe depuis le 03/10 (EF-12-03), mais seulement par l'API : pas encore d'écran d'administration. | import livré, **données et écran à venir** |
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

## Parcours commande et livraison

Le processus complet — appel aux pharmacies du quartier, attribution au premier déclarant, mise en concurrence des motards, vérification à la remise, suivi sur carte — est décrit dans **`PARCOURS-COMMANDE-LIVRAISON.md`**, avec **dix questions ouvertes** à trancher avant d'écrire P6, P7 et P8.

Deux d'entre elles conditionnent le reste : le **moment du paiement** (avant le départ pour les médicaments, à l'arrivée pour le transport — à confirmer) et la **maille géographique**, qui n'existe pas encore en base.

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
| 2026-09-30 | P13→P1 | **Bloc 5 de l'addendum livré (API + front)** : le patient demande un rendez-vous depuis chez lui, l'accueil oriente ce que personne ne vise, le médecin accepte en fixant l'heure — ce geste ouvre l'épisode et le rendez-vous dans la même transaction. La demande n'ouvre pas d'épisode tant qu'elle n'est pas acceptée : un épisode est une visite, et une demande n'en est pas encore une. 376 tests API. |
| 2026-09-30 | P2 | **Bloc 4 de l'addendum livré** : le rôle `BIOLOGISTE` disparaît, le laborantin valide. Migration écrite à la main — Prisma proposait une conversion d'énumération qui **échoue** sur les comptes existants, et un `DROP COLUMN` qui aurait effacé les 4 conclusions de laboratoire. Vérifié : 2 comptes migrés, 4 conclusions préservées. `commentaireBiologiste` devient `commentaireLaboratoire`. Le compte rendu n'imprime plus « Biologiste » sous le signataire : cette qualification n'a jamais été stockée. |
| 2026-09-30 | P1 | **Bloc 3 de l'addendum livré (API + front)** : l'accueil oriente sans date, le médecin fixe le créneau et tient son agenda, l'assistante pointe l'arrivée. `RendezVous.statut` devient une énumération — ce qui a révélé que `asc.service.ts` comptait des rendez-vous « HONORE » que personne n'écrivait jamais, compteur structurellement à zéro. Migration écrite à la main : `prisma migrate diff` proposait un DROP COLUMN qui aurait effacé les statuts. 351 tests API. |
| 2026-09-29 | P1/P2 | **Bloc 2 de l'addendum livré (API + front)** : le médecin prescrit les analyses depuis un écran « Dossier de la visite » ; l'accueil ne fait plus rien de médical. Vérifié en appelant réellement l'API avec le compte du médecin avant d'écrire quoi que ce soit — il avait déjà le droit. `requireRole` porte désormais ses rôles, ce qui rend le câblage des permissions vérifiable : 14 tests décrivent qui peut atteindre quoi, alors qu'aucun ne le faisait avant. 321 tests API. |
| 2026-09-28 | P2 | **Bloc 1 de l'addendum livré (API + front)** : le patient ne voit un résultat qu'après libération par un médecin, avec explication en langage clair. La diffusion automatique à 24 h est supprimée, remplacée par une relance du médecin (12 h) puis une escalade vers l'admin de structure (48 h) — jamais vers le patient. Les 4 tests qui verrouillaient l'ancienne règle ont échoué au premier lancement et ont été réécrits ; 2 sabotages vérifiés. 305 tests API, 21 web. Dette soldée au passage : `prisma.config.js` supprimé (il faisait échouer migrate, generate et diff). |
| 2026-09-28 | CDC | Compléments : **agenda du médecin** (point 8, l'index existe déjà en base) et arbitrage téléconsultation — la **prise de rendez-vous à distance se fait maintenant**, la consultation à distance réelle attend D2. |
| 2026-09-28 | CDC | **Addendum du chef de projet** (`ADDENDUM-CDC-2026-09-28.md`) : huit points, dont **trois reprises de code livré** (RDV fixés par le médecin, suppression du rôle biologiste, résultats libérés par le médecin). Trois arbitrages tranchés le jour même. Ordonnancement proposé : les reprises d'abord, ~20 à 27 jours au total. Cinq questions restent ouvertes. |
| 2026-09-26 | P6 | Socle commande pharmacie (API) : quartier/commune, pharmacie partenaire, rôle `LIVREUR`, `Commande` + `ReponsePharmacie`, appel au quartier, attribution atomique au premier déclarant, rétractation, choix du mode de remise. 283 tests API. Front à faire. |
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

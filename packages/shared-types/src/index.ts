// ─── Common API wrapper types ──────────────────────────────────────────────────
export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  meta?: PaginationMeta;
  error?: string;
  message?: string;
}

export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Enums (mirror Prisma schema values) ──────────────────────────────────────
export type Role =
  | 'PATIENT'
  | 'ASC'
  | 'ASC_SUPERVISOR'
  | 'MEDECIN'
  | 'PHARMACIEN'
  | 'AGENT_ACCUEIL'
  | 'TECHNICIEN_LABO'
  | 'BIOLOGISTE'
  | 'LIVREUR'
  | 'ADMIN_STRUCTURE'
  | 'ADMIN_REGIONAL'
  | 'ADMIN_NATIONAL'
  | 'SUPER_ADMIN';

export type EncounterStatus =
  | 'PLANIFIEE'
  | 'EN_COURS'
  | 'TERMINEE'
  | 'ANNULEE'
  | 'REFERENCEE';

export type ReferralStatus =
  | 'EN_ATTENTE'
  | 'ACCEPTE'
  | 'REFUSE'
  | 'COMPLETE';

export type InvoiceStatus =
  | 'EN_ATTENTE'
  | 'PAYEE'
  | 'PARTIELLE'
  | 'ANNULEE'
  | 'REMBOURSEE';

export type ModePaiement =
  | 'ESPECES'
  | 'ORANGE_MONEY'
  | 'MTN_MOMO';

export type TypeStructure =
  | 'POSTE'
  | 'CENTRE'
  | 'HOPITAL_PREF'
  | 'HOPITAL_REG'
  | 'CHU'
  | 'CLINIQUE'
  | 'PHARMACIE'
  | 'LABORATOIRE';

/**
 * Partage par l'ordonnance (le document) et par ses lignes. Une ligne ne prend
 * que `EN_ATTENTE` ou `DELIVREE` ; le document ajoute `PARTIELLEMENT_SERVIE` et
 * `SERVIE`, deduits de ses lignes.
 */
export type StatutOrdonnance =
  | 'EN_ATTENTE'
  | 'DELIVREE'
  | 'PARTIELLEMENT_SERVIE'
  | 'SERVIE'
  | 'EXPIREE'
  | 'ANNULEE';

export type Urgence = 'ROUTINE' | 'URGENT' | 'URGENCE_VITALE';

export type StatutEpisode = 'OUVERT' | 'EN_COURS' | 'CLOS' | 'ANNULE';
export type StatutDemandeAnalyse = 'TRANSMISE' | 'RECUE' | 'PRELEVEE' | 'EN_ANALYSE' | 'VALIDEE' | 'ANNULEE';
export type LieuPrelevement = 'SUR_PLACE' | 'DOMICILE';
export type InterpretationResultat = 'NORMAL' | 'ANORMAL' | 'CRITIQUE';

export type SyncOperation = 'CREATE' | 'UPDATE' | 'DELETE';

export type ConsentScope =
  | 'DOSSIER_MEDICAL'
  | 'FHIR_EXPORT'
  | 'RAPPELS_SMS'
  | 'RECHERCHE_ANONYMISEE';

export type TypeNotification =
  | 'RAPPEL_RENDEZ_VOUS'
  | 'REFERENCEMENT_ACCEPTE'
  | 'REFERENCEMENT_REFUSE'
  | 'ALERTE_STOCK'
  | 'RAPPEL_VACCINATION'
  | 'ORDONNANCE_SIGNEE'
  | 'NOUVEAU_MESSAGE'
  | 'ALERTE_VITALE'
  | 'EPISODE_OUVERT'
  | 'DEMANDE_ANALYSE'
  | 'ORIENTATION'
  | 'PRELEVEMENT_PLANIFIE'
  | 'RESULTATS_DISPONIBLES'
  | 'RESULTAT_CRITIQUE'
  | 'ESCALADE_CRITIQUE'
  | 'COMMANDE_A_SERVIR'
  | 'COMMANDE_PRISE_EN_CHARGE'
  | 'COMMANDE_SANS_PHARMACIE';

/** Statut d'une commande pharmacie (EF-07). */
export type StatutCommande =
  | 'RECHERCHE_PHARMACIE'
  | 'PRISE_EN_CHARGE'
  | 'SANS_PHARMACIE'
  | 'ANNULEE';

/**
 * Comment le patient recupere ses produits. La livraison n'est jamais
 * imposee : beaucoup de patients habitent a cote d'une pharmacie.
 */
export type ModeRemise = 'RETRAIT_PHARMACIE' | 'LIVRAISON';

export type CanalNotification = 'SMS' | 'PUSH' | 'IN_APP';

// ─── Auth DTOs ─────────────────────────────────────────────────────────────────
export interface LoginDto {
  identifiant: string;
  motDePasse: string;
}

export interface RegisterDto {
  telephone: string;
  email?: string;
  motDePasse: string;
  prenom: string;
  nom: string;
}

export interface VerifyLoginOtpDto {
  email: string;
  code: string;
}

export interface OtpRequestDto {
  telephone: string;
}

export interface OtpVerifyDto {
  telephone: string;
  code: string;
}

export interface ForgotPasswordDto {
  email: string;
}

export interface ResetPasswordDto {
  token: string;
  nouveauMotDePasse: string;
}

export interface OtpLoginChallenge {
  requiresOtp: true;
  email: string;
  message: string;
  expiresInMinutes: number;
  devOtp?: string;
}

export interface UserDto {
  id: string;
  telephone: string;
  email?: string;
  nom: string;
  prenom: string;
  role: Role;
  langue: string;
  photoUrl?: string;
  estActif: boolean;
  doitChangerMotDePasse: boolean;
  creeLe: string;
  modifieLe: string;
}

// ─── Patient DTOs ──────────────────────────────────────────────────────────────
export interface CreatePatientDto {
  telephone: string;
  motDePasse: string;
  prenom: string;
  nom: string;
  dateNaissance: string;
  sexe: string;
  prefecture: string;
  sousPrefecture?: string;
  village?: string;
  groupeSanguin?: string;
  allergies?: string[];
  maladiesChroniques?: string[];
  urgenceNom?: string;
  urgenceTelephone?: string;
}

export interface UpdatePatientDto {
  prenom?: string;
  nom?: string;
  email?: string;
  langue?: string;
  photoUrl?: string;
  groupeSanguin?: string;
  allergies?: string[];
  maladiesChroniques?: string[];
  sousPrefecture?: string;
  village?: string;
  urgenceNom?: string;
  urgenceTelephone?: string;
}

export interface PatientFilters {
  prefecture?: string;
  page?: number;
  limit?: number;
  search?: string;
}

// ─── Consultation DTOs ─────────────────────────────────────────────────────────
export interface CreateConsultationDto {
  idPatient: string;
  motifPrincipal: string;
  symptomes?: string[];
}

export interface VitalsDto {
  temperature?: number;
  poidsKg?: number;
  tailleCm?: number;
  perimetreBrachial?: number;
  tensionSystolique?: number;
  tensionDiastolique?: number;
  frequenceCardiaque?: number;
  frequenceRespiratoire?: number;
  spo2?: number;
  glycemie?: number;
}

export interface DiagnosticDto {
  libelle: string;
  codeIcd11?: string;
  typeDiagnostic?: 'PRINCIPAL' | 'DIFFERENTIEL' | 'SECONDAIRE';
  severite?: 'LEGER' | 'MODERE' | 'SEVERE' | 'CRITIQUE';
  source: 'IA_LOCALE' | 'IA_CLAUDE' | 'MEDECIN' | 'ASC';
}

export interface OrdonnanceDto {
  idMedicament: string;
  posologie: string;
  frequence: string;
  dureeJours: number;
  quantite?: number;
  instructions?: string;
  /**
   * EF-05-06 : pourquoi le prescripteur passe outre une alerte. L'API
   * recalcule les alertes de son cote — ce champ ne les declare pas, il les
   * justifie.
   */
  motifDepassement?: string;

  /**
   * EF-05-09 : renouvellements accordes, portes par l'ordonnance entiere. La
   * derniere valeur transmise fait foi pour le document en cours de redaction.
   * Refuse des qu'un produit reglemente y figure.
   */
  renouvellementsAutorises?: number;
}

export interface ReferralDto {
  idStructureCible: string;
  urgence: Urgence;
  resumeClinique: string;
}

export interface ConsultationFilters {
  idPatient?: string;
  idAsc?: string;
  statut?: EncounterStatus;
  page?: number;
  limit?: number;
}

// ─── Vaccination DTOs ──────────────────────────────────────────────────────────
export interface CreateVaccinationDto {
  idPatient: string;
  vaccinNom: string;
  codeEpi?: string;
  numeroLot?: string;
  siteInjection?: string;
  reaction?: string;
  dateProchaineD?: string;
}

export interface UpdateVaccinationDto {
  reaction?: string;
  urlCertificat?: string;
  dateProchaineD?: string;
}

export interface VaccinationFilters {
  idPatient?: string;
  vaccinNom?: string;
  page?: number;
  limit?: number;
}

// ─── Paiement DTOs ────────────────────────────────────────────────────────────
export interface InitierPaiementDto {
  idConsultation: string;
  montantGnf: number;
  modePaiement: ModePaiement;
  numeroOperateur?: string;
}

export interface ConfirmerPaiementDto {
  referenceOperateur: string;
}

export interface PaiementFilters {
  statut?: InvoiceStatus;
  modePaiement?: ModePaiement;
  page?: number;
  limit?: number;
}

// ─── Notification DTOs ─────────────────────────────────────────────────────────
export interface SendNotificationDto {
  idDestinataire: string;
  type: TypeNotification;
  titre: string;
  contenu: string;
  canal: CanalNotification;
  metadata?: Record<string, unknown>;
}

export interface NotificationFilters {
  lu?: boolean;
  type?: TypeNotification;
  page?: number;
  limit?: number;
}

// ─── Structure DTOs ───────────────────────────────────────────────────────────
export interface CreateStructureDto {
  nom: string;
  type: TypeStructure;
  prefecture: string;
  adresse?: string;
  telephone?: string;
  latitude?: number;
  longitude?: number;
  admin: {
    prenom: string;
    nom: string;
    telephone: string;
    email?: string;
  };
}

export interface CreatePharmacieDto {
  nom: string;
  prefecture: string;
  adresse?: string;
  telephone?: string;
  latitude?: number;
  longitude?: number;
  pharmacien: {
    prenom: string;
    nom: string;
    telephone: string;
    email?: string;
  };
}

// ─── Triage DTOs ──────────────────────────────────────────────────────────────
export interface TriagePayload {
  ageAnnees?: number;
  symptomes: string[];
  constantes?: {
    temperature?: number;
    spo2?: number;
    frequenceRespiratoire?: number;
    frequenceCardiaque?: number;
    tensionSystolique?: number;
    glycemie?: number;
  };
}

export interface TriageHypothese {
  pathologie: string;
  score: number;
  signes: string[];
  conduite: string;
  urgence: Urgence;
}

export interface TriageResult {
  moteur: string;
  urgence: Urgence;
  alertes: string[];
  hypotheses: TriageHypothese[];
  recommandation: string;
  avertissement: string;
}

// ─── ASC DTOs ─────────────────────────────────────────────────────────────────
export interface CreateStockDto {
  idMedicament: string;
  quantite: number;
  unite: string;
  seuilAlerte?: number;
  datePeremption?: string;
}

export interface UpdateStockDto {
  quantite: number;
  unite: string;
  seuilAlerte?: number;
  datePeremption?: string;
}

export interface StockFilters {
  seuilAlerte?: boolean;
  page?: number;
  limit?: number;
}

export interface RapportFilters {
  mois: number;
  annee: number;
}

// ─── Médecin DTOs ─────────────────────────────────────────────────────────────
export interface SignerOrdonnanceDto {
  idOrdonnance: string;
}

/**
 * POST /pharmacien/ordonnances/verifier (EF-07-01). Le numero seul ne suffit
 * pas : il est sequentiel, donc devinable. Le code prouve que le porteur a
 * l'ordonnance en main.
 */
export interface VerifierOrdonnanceDto {
  numero: string;
  codeVerification: string;
}

export interface ValiderConsultationDto {
  notesMedecin: string;
  idOrdonnances?: string[];
}

export interface RepondreReferencementDto {
  statut: 'ACCEPTE' | 'REFUSE';
  motifRefus?: string;
}

export interface MedecinFilters {
  statut?: ReferralStatus;
  prefecture?: string;
  page?: number;
  limit?: number;
}

export interface SendMessageDto {
  idDestinataire: string;
  contenu: string;
  idConsultation?: string;
}

// ─── Pharmacien DTOs ──────────────────────────────────────────────────────────
export interface DelivrancePayload {
  lignesDelivrees: {
    idLigneOrdonnance: string;
    quantiteDelivree: number;
    substitutId?: string;
  }[];
}

// ─── Canonical view models (API response shapes) ──────────────────────────────

// Les colonnes nullables de Prisma arrivent en `null`, pas en `undefined`.
export interface DiagnosticView {
  id: string;
  libelle: string;
  codeIcd11?: string | null;
  typeDiagnostic?: string;
  severite?: string | null;
  source: string;
}

/**
 * Gravite d'une alerte de prescription (EF-05-05). L'ordre compte :
 * `PRECAUTION` informe, les deux autres appellent un motif de depassement.
 */
export type NiveauInteraction =
  | 'PRECAUTION'
  | 'ASSOCIATION_DECONSEILLEE'
  | 'CONTRE_INDICATION';

export type TypeAlertePrescription = 'ALLERGIE' | 'INTERACTION' | 'CONTRE_INDICATION';

/**
 * Une raison de ne pas prescrire ce medicament a ce patient. L'alerte ne
 * bloque jamais : elle informe le prescripteur, qui reste seul juge et motive
 * son choix s'il passe outre (EF-05-06).
 */
export interface AlertePrescriptionView {
  type: TypeAlertePrescription;
  niveau: NiveauInteraction;
  /** Titre court, affichable tel quel. */
  libelle: string;
  detail: string;
  /** Conduite a tenir, quand le referentiel en propose une. */
  conduite?: string | null;
  /** Le medicament deja prescrit qui entre en interaction, le cas echeant. */
  medicamentEnCause?: string | null;
  /** Referentiel d'origine, pour pouvoir reexaminer une regle contestee. */
  source?: string | null;
}

/** Reponse de POST /consultations/:id/ordonnances/alertes. */
export interface AlertesPrescriptionView {
  alertes: AlertePrescriptionView[];
  /**
   * Calcule par l'API : au moins une alerte depasse la simple precaution, un
   * motif est donc attendu. Le client ne recalcule pas ce seuil.
   */
  motifRequis: boolean;
}

/** POST /consultations/:id/ordonnances/alertes */
export interface VerifierPrescriptionDto {
  idMedicament: string;
}

/** Un medicament prescrit. La delivrance se fait a ce niveau. */
export interface LigneOrdonnanceView {
  id: string;
  statut: StatutOrdonnance;
  posologie: string;
  frequence: string;
  dureeJours: number;
  quantite?: number | null;
  instructions?: string | null;
  medicament?: { id: string; dci: string; nomCommercial?: string | null; forme: string; dosage: string; estReglemente?: boolean };
  /** Ce qui a ete montre au prescripteur au moment de la prescription. */
  alertes?: AlertePrescriptionView[] | null;
  motifDepassement?: string | null;
}

/**
 * L'ordonnance est un document, pas un medicament : c'est lui qui porte le
 * numero et le code que la pharmacie controle avant de delivrer (EF-05-07/08).
 * `codeVerification` n'est expose qu'au patient et au prescripteur — jamais
 * dans une liste destinee a un tiers.
 */
export interface OrdonnanceView {
  id: string;
  numero: string;
  statut: StatutOrdonnance;
  codeVerification?: string;
  valideJusquau: HorodatageApi;
  /** Calcule par l'API : `valideJusquau` depasse. */
  expiree: boolean;
  signeLe?: HorodatageApi | null;
  signataire?: { prenom: string; nom: string } | null;
  creeLe: HorodatageApi;
  lignes: LigneOrdonnanceView[];

  /** EF-05-09. Le numero et le code ne changent pas d'un cycle a l'autre. */
  renouvellementsAutorises: number;
  renouvellementsUtilises: number;
  /** Calcule par l'API : renouvellements restants, une fois l'ordonnance servie. */
  renouvellementsRestants: number;
  /** Calcule par l'API : au moins un medicament est a circuit reglemente (EF-05-12). */
  contientProduitReglemente: boolean;
}

// Une constante non saisie arrive en `null` (colonne nullable Prisma serialisee
// telle quelle), pas en `undefined` : le type le dit desormais, pour que le
// client traite le cas au lieu de le supposer absent.
export interface ConstantesVitalesView {
  id?: string;
  temperature?: number | null;
  poidsKg?: number | null;
  tailleCm?: number | null;
  perimetreBrachial?: number | null;
  tensionSystolique?: number | null;
  tensionDiastolique?: number | null;
  frequenceCardiaque?: number | null;
  frequenceRespiratoire?: number | null;
  spo2?: number | null;
  glycemie?: number | null;
  alertes?: string[];
}

export interface ConsultationView {
  id: string;
  statut: EncounterStatus;
  motifPrincipal: string;
  consulteeLE: string;
  notesAsc?: string;
  notesMedecin?: string;
  idPatient?: string;
  constantes?: ConstantesVitalesView;
  asc?: { utilisateur: { prenom: string; nom: string } };
  medecinValideur?: { prenom: string; nom: string };
  diagnostics?: DiagnosticView[];
  ordonnances?: OrdonnanceView[];
}

// ─── Analytics DTOs ───────────────────────────────────────────────────────────
export interface AnalyticsFilters {
  prefecture?: string;
  debut?: string;
  fin?: string;
  annee?: number;
  mois?: number;
}

export interface ExportFilters {
  format: 'JSON' | 'CSV' | 'DHIS2';
  debut?: string;
  fin?: string;
  prefecture?: string;
  page?: number;
  limit?: number;
}

// ─── Analytics — vues renvoyees par l'API ─────────────────────────────────────
// Ces formes sont le contrat entre analytics.service.ts (qui les declare comme
// type de retour) et le tableau de bord admin. Les declarer ici plutot que de
// les redeclarer dans le composant evite la derive silencieuse : un champ
// renomme cote API casse desormais le build de l'API, au lieu de vider un
// onglet sans aucun signal.

export interface AnalyticsKpisView {
  totalPatients: number;
  totalConsultations: number;
  totalVaccinations: number;
  totalReferencements: number;
  totalAsc: number;
}

export interface ConsultationsParStatutView {
  statut: string;
  count: number;
}

export interface TopPathologieView {
  pathologie: string;
  count: number;
}

export interface DashboardAnalyticsView {
  kpis: AnalyticsKpisView;
  consultationsParStatut: ConsultationsParStatutView[];
  topPathologies: TopPathologieView[];
}

export interface HeatmapPointView {
  prefecture: string;
  count: number;
  pathologies: Record<string, number>;
  latitude?: number;
  longitude?: number;
}

export type NiveauAlerte = 'ATTENTION' | 'ALERTE' | 'URGENCE';

export interface AlerteEpidemiqueView {
  pathologie: string;
  prefecture: string;
  nombre: number;
  seuil: number;
  niveau: NiveauAlerte;
  /** Serialise en chaine ISO par la reponse JSON. */
  dateDetection: string;
}

export interface CouvertureVaccinView {
  vaccin: string;
  patientsVaccines: number;
  totalPatients: number;
  tauxCouverture: number;
}

/** GET /analytics/vaccinations/couverture renvoie un objet, pas un tableau. */
export interface CouvertureVaccinaleView {
  totalPatients: number;
  couverture: CouvertureVaccinView[];
  prefecture: string;
}

export interface TendanceView {
  mois: string;
  consultations: number;
  vaccinations: number;
  referencements: number;
}

// ─── Consultation — vue detaillee (GET /consultations/:id) ────────────────────
// ConsultationView ci-dessus decrit la vue liste. Le detail renvoie davantage :
// le patient, les constantes, les diagnostics, les ordonnances et le
// referencement avec sa structure cible.
//
// Les champs de date sont typees `HorodatageApi` : le fil transporte toujours
// une chaine ISO, mais le meme type annote aussi le controleur, ou Prisma
// fournit un Date. L'union laisse passer les deux. Ce qui est garanti — et
// c'est le point — ce sont les noms et la presence des champs.
export type HorodatageApi = string | Date;

export interface PatientResumeView {
  id: string;
  qrCode?: string;
  dateNaissance?: HorodatageApi;
  sexe?: string;
  groupeSanguin?: string | null;
  allergies?: string[];
  utilisateur?: {
    prenom: string;
    nom: string;
    telephone: string;
    photoUrl?: string | null;
  };
}

export interface DiagnosticDetailView extends DiagnosticView {
  statutClinique: string;
  creeLe: HorodatageApi;
}

export interface ReferencementView {
  id: string;
  urgence: string;
  statut: string;
  resumeClinique: string;
  structureCible?: {
    id: string;
    nom: string;
    type: string;
    prefecture: string;
  };
}

export interface ConsultationDetailView {
  id: string;
  statut: EncounterStatus;
  motifPrincipal: string;
  symptomes: string[];
  notesAsc?: string | null;
  protocoleUtilise?: string | null;
  confianceIa?: number | null;
  resumeIa?: string | null;
  consulteeLE: HorodatageApi;
  patient: PatientResumeView;
  constantes?: ConstantesVitalesView | null;
  diagnostics: DiagnosticDetailView[];
  ordonnances: OrdonnanceView[];
  referencement?: ReferencementView | null;
}

// ─── Catalogues (listes deroulantes) ──────────────────────────────────────────
export interface MedicamentView {
  id: string;
  dci: string;
  nomCommercial?: string | null;
  forme: string;
  dosage: string;
  /**
   * EF-05-12 : circuit reglemente (stupefiant, psychotrope). L'ecran de
   * prescription le signale avant la saisie ; l'API applique la regle de toute
   * facon.
   */
  estReglemente?: boolean;
}

export interface StructureView {
  id: string;
  nom: string;
  type: string;
  prefecture: string;
}

// ─── Stocks (poste ASC) ───────────────────────────────────────────────────────
// GET /asc/stocks renvoie la ligne de stock avec son medicament, plus un
// indicateur `enAlerte` calcule par le service.
export interface StockAscView {
  id: string;
  quantite: number;
  seuilAlerte: number;
  unite: string;
  datePeremption?: HorodatageApi | null;
  enAlerte: boolean;
  medicament: MedicamentView & { categorie?: string | null };
}

// ─── Planning (rendez-vous d'un agent) ────────────────────────────────────────
// GET /asc/planning renvoie les rendez-vous a venir avec leur patient.
// L'horodatage s'appelle `prevuLe` : il n'y a ni `date` ni `heure` separes.
export interface RendezVousAscView {
  id: string;
  statut: string;
  motif?: string | null;
  prevuLe: HorodatageApi;
  patient?: {
    utilisateur?: { prenom: string; nom: string; telephone: string };
  };
}

// ─── Espace medecin ───────────────────────────────────────────────────────────

/** GET /medecin/consultations — consultations terminees en attente de validation. */
export interface ConsultationAValiderView {
  id: string;
  statut: EncounterStatus;
  motifPrincipal: string;
  consulteeLE: HorodatageApi;
  notesMedecin?: string | null;
  idMedecinValideur?: string | null;
  patient?: PatientResumeView;
  // La relation ASC est optionnelle en base : une consultation saisie hors
  // parcours agent arrive avec `asc: null`.
  asc?: { utilisateur: { prenom: string; nom: string } } | null;
  constantes?: ConstantesVitalesView | null;
  diagnostics: DiagnosticDetailView[];
  ordonnances: OrdonnanceView[];
}

/** GET /medecin/dashboard. `structure` est la structure de rattachement. */
export interface MedecinDashboardView {
  consultationsValidees: number;
  consultationsEnAttente: number;
  referencementsEnAttente: number;
  messagesNonLus: number;
  structure: { nom: string; type: string; prefecture: string } | null;
}

/**
 * Interlocuteur d'un message. `id` est absent du select cote API : le client
 * le reconstruit depuis idExpediteur / idDestinataire du message porteur.
 */
export interface UtilisateurResumeView {
  id?: string;
  prenom: string;
  nom: string;
  photoUrl?: string | null;
  role?: string;
}

/** GET /medecin/messages. */
export interface MessageView {
  id: string;
  contenu: string;
  envoyeLe: HorodatageApi;
  lu: boolean;
  idExpediteur: string;
  idDestinataire: string;
  expediteur: UtilisateurResumeView;
  destinataire: UtilisateurResumeView;
}

// ─── Espace pharmacien ────────────────────────────────────────────────────────
// Medicament + tarif : le catalogue porte un prix national de reference.
export interface MedicamentTarifeView extends MedicamentView {
  categorie?: string | null;
  prixUnitaireGnf: number;
}

/** Une ligne de l'ordonnance au comptoir : c'est l'unite de delivrance. */
export interface LigneDelivranceView {
  id: string;
  posologie: string;
  frequence: string;
  dureeJours: number;
  quantite: number;
  statut: StatutOrdonnance;
  instructions?: string | null;
  medicament: MedicamentTarifeView;
  /** EF-05-12 : circuit reglemente, signale ligne par ligne au comptoir. */
  estReglemente: boolean;
  /** Calcule par l'API : quantite x prix unitaire. */
  prixTotalGnf: number;
  /** Calcule par l'API : le principe actif figure dans les allergies du patient. */
  alerteAllergie: boolean;
}

/** Ordonnance telle que presentee au comptoir (GET /pharmacien/scan/:qrCode). */
export interface OrdonnanceDelivranceView {
  id: string;
  numero: string;
  statut: StatutOrdonnance;
  valideJusquau: HorodatageApi;
  /** Calcule par l'API : `valideJusquau` depasse au moment de la lecture. */
  expiree: boolean;
  signeLe: HorodatageApi | null;
  /** Calcule par l'API : signataire de l'ordonnance, ou l'agent a defaut. */
  medecinNom: string;
  lignes: LigneDelivranceView[];
  /** Calcule par l'API : somme des lignes restant a delivrer. */
  totalGnf: number;

  /** EF-05-09 : ce qu'il reste apres la delivrance en cours. */
  renouvellementsRestants: number;
  /** EF-05-12 : impose le controle d'identite au comptoir. */
  contientProduitReglemente: boolean;
}

/**
 * Reponse de POST /pharmacien/ordonnances/verifier (EF-07-01). Une ordonnance
 * refusee renvoie toujours un motif lisible au comptoir : le pharmacien doit
 * pouvoir l'expliquer au patient.
 */
export interface VerificationOrdonnanceView {
  valide: boolean;
  motif?: string;
  ordonnance?: OrdonnanceDelivranceView;
  patient?: PatientScanView;
}

/**
 * GET /pharmacien/ordonnances — ordonnances en attente des patients de la
 * prefecture de la pharmacie. `qrCode` permet d'ouvrir directement la
 * delivrance (meme parcours que le scan).
 */
export interface OrdonnanceEnAttenteView {
  id: string;
  numero: string;
  statut: StatutOrdonnance;
  valideJusquau: HorodatageApi;
  expiree: boolean;
  creeLe: HorodatageApi;
  signeLe: HorodatageApi | null;
  /** Les medicaments restant a delivrer, pour situer l'ordonnance en un coup d'oeil. */
  medicaments: MedicamentView[];
  patient: { prenom: string; nom: string; qrCode: string };
}

export interface PatientScanView {
  prenom: string;
  nom: string;
  dateNaissance: string;
  sexe: string;
  groupeSanguin?: string;
  allergiesCritiques: string[];
}

export interface ScanPatientView {
  patient: PatientScanView;
  ordonnances: OrdonnanceDelivranceView[];
  totalOrdonnances: number;
}

/** GET /pharmacien/stocks — ligne de stock d'une officine. */
export interface StockPharmacieView {
  id: string;
  quantite: number;
  seuilAlerte: number;
  unite: string;
  datePeremption?: HorodatageApi | null;
  margeGnf: number;
  medicament: MedicamentTarifeView;
}

// ─── Vaccinations ─────────────────────────────────────────────────────────────
// GET /vaccinations/me renvoie les lignes Prisma avec l'agent administrant.
// Les noms sont ceux du schema : `vaccinNom` et `administreLe`. Le front a
// longtemps tente `nomVaccin` et `dateAdministration`, qui n'existent pas.
export interface VaccinationView {
  id: string;
  vaccinNom: string;
  codeEpi?: string | null;
  numeroLot?: string | null;
  siteInjection?: string | null;
  reaction?: string | null;
  urlCertificat?: string | null;
  dateProchaineD?: HorodatageApi | null;
  administreLe: HorodatageApi;
  administrePar?: { prenom: string; nom: string; role?: string };
}

// ─── Structures de sante ──────────────────────────────────────────────────────

/**
 * GET /admin-structure/structures/publiques — liste ouverte, servie sans
 * authentification, qui alimente le choix de structure preferee du patient.
 * Le select est volontairement etroit : ni `estActive` (seules les actives
 * sortent), ni compteurs, ni utilisateurs rattaches.
 */
export interface StructurePubliqueView {
  id: string;
  nom: string;
  type: string;
  prefecture: string;
  adresse?: string | null;
  telephone?: string | null;
}

/**
 * GET /admin-structure/structures — vue super-admin : toutes les structures,
 * desactivees comprises, avec le nombre d'utilisateurs rattaches et les
 * administrateurs de la structure.
 */
export interface StructureAdminView {
  id: string;
  nom: string;
  type: string;
  prefecture: string;
  adresse?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  telephone?: string | null;
  photoUrl?: string | null;
  estActive: boolean;
  creeLe: HorodatageApi;
  _count?: { utilisateurs: number };
  utilisateurs?: { prenom: string; nom: string; telephone: string }[];
}

/** Compte cree en meme temps qu'une structure ou une pharmacie. */
export interface CompteCreeView {
  id: string;
  prenom: string;
  nom: string;
  telephone: string;
  email?: string | null;
  role: Role;
}

/**
 * POST /admin-structure/structures et /pharmacies.
 *
 * Les deux renvoient la structure sous la cle `structure` — il n'existe pas de
 * cle `pharmacie`. Seul le compte cree change de nom : `admin` d'un cote,
 * `pharmacien` de l'autre.
 *
 * `motDePasseTemporaire` n'est present que si l'API a genere le mot de passe,
 * c'est-a-dire quand l'appelant n'en a pas fourni.
 */
export interface CreationStructureView {
  structure: StructureAdminView;
  admin: CompteCreeView;
  motDePasseTemporaire?: string;
}

export interface CreationPharmacieView {
  structure: StructureAdminView;
  pharmacien: CompteCreeView;
  motDePasseTemporaire?: string;
}

// ─── Espace admin de structure ────────────────────────────────────────────────

/** GET /admin-structure/agents — agents actifs rattaches a la structure. */
export interface AgentStructureView {
  id: string;
  telephone: string;
  email?: string | null;
  prenom: string;
  nom: string;
  role: Role;
  creeLe: HorodatageApi;
  derniereConnexion?: HorodatageApi | null;
}

/**
 * POST /admin-structure/agents.
 *
 * `agent` ne porte pas l'email : l'ecran affiche l'adresse saisie, pas une
 * valeur renvoyee par l'API. `motDePasseTemporaire` n'est present que si
 * l'API a genere le mot de passe.
 */
export interface CreationAgentView {
  agent: {
    id: string;
    telephone: string;
    prenom: string;
    nom: string;
    role: Role;
  };
  motDePasseTemporaire?: string;
}

/**
 * GET /admin-structure/stats.
 * `structure` provient d'un findUnique : le type garde la nullabilite.
 */
export interface StatsStructureView {
  structure: StructureAdminView | null;
  totalAgents: number;
  totalConsultations: number;
  totalPatients: number;
}

// ─── Referencements (espace medecin) ─────────────────────────────────────────

/**
 * GET /medecin/referencements — referencement dirige vers la structure du
 * medecin, avec le contexte clinique de la consultation d'origine.
 * PUT /medecin/referencements/:id/repondre renvoie la meme forme.
 */
export interface ReferencementATraiterView {
  id: string;
  urgence: Urgence;
  statut: ReferralStatus;
  resumeClinique: string;
  motifRefus: string | null;
  urlDocument: string | null;
  creeLe: HorodatageApi;
  reponduLe: HorodatageApi | null;
  consultation: {
    id: string;
    motifPrincipal: string;
    symptomes: string[];
    consulteeLE: HorodatageApi;
    patient: PatientResumeView & { prefecture: string };
    constantes: ConstantesVitalesView | null;
    diagnostics: DiagnosticView[];
  };
  structureSource: StructureView | null;
  structureCible: StructureView;
}

// ─── Confidentialite patient ─────────────────────────────────────────────────

/** GET/PUT /privacy/me/consents — ligne de la table consentements_patient. */
export interface ConsentementView {
  id: string;
  scope: ConsentScope;
  actif: boolean;
  donneLe: HorodatageApi;
  retireLe: HorodatageApi | null;
  source: string;
  commentaire: string | null;
  idPatient: string;
  idUtilisateur: string;
}

/** PUT /privacy/me/consents */
export interface SetConsentementDto {
  scope: ConsentScope;
  actif: boolean;
  source?: string;
  commentaire?: string;
}

/** GET /privacy/me/audit-logs — acces journalises au dossier du patient. */
export interface AccesDossierView {
  id: string;
  action: string;
  ressource: string;
  idRessource: string | null;
  creeLe: HorodatageApi;
  utilisateur: {
    id: string;
    prenom: string;
    nom: string;
    role: Role;
  };
}

// ─── Notifications in-app ────────────────────────────────────────────────────

/** GET /notifications/me — une notification destinee a l'utilisateur connecte. */
export interface NotificationView {
  id: string;
  type: TypeNotification;
  titre: string;
  contenu: string;
  lienAction: string | null;
  metadonnees: Record<string, unknown> | null;
  luLe: HorodatageApi | null;
  creeLe: HorodatageApi;
}

/** GET /notifications/me/non-lues */
export interface NotificationsNonLuesView {
  nonLues: number;
}

/** Evenement Socket.IO `notification:new` — meme forme que la vue REST. */
export type NotificationTempsReel = NotificationView;

// ─── Parametres systeme (super-admin) ────────────────────────────────────────

export interface ParametresFacturationView {
  paiementEspeces: boolean;
  paiementOrangeMoney: boolean;
  paiementMomo: boolean;
  /** Marge par defaut appliquee sur les medicaments, en pourcentage. */
  margePct: number;
}

export interface ParametresSecuriteView {
  /**
   * A la creation d'un dossier, accorder d'office les consentements
   * necessaires aux soins (DOSSIER_MEDICAL, RAPPELS_SMS). FHIR_EXPORT et
   * RECHERCHE_ANONYMISEE restent toujours au choix du patient.
   */
  consentementDefaut: boolean;
}

export interface ParametresAlertesView {
  /** Cas de paludisme par prefecture sur 30 jours avant alerte. */
  seuilPaludisme: number;
  /** Cas d'Ebola par prefecture sur 30 jours avant alerte. */
  seuilEbola: number;
  activerIA: boolean;
}

export interface ParametresSyncView {
  offlineMode: boolean;
  frequenceMinutes: number;
  ussdTimeoutSecondes: number;
}

/** GET /sync/config — sous-ensemble des parametres lu par le client web (file hors-ligne). */
export interface ConfigSyncView {
  offlineMode: boolean;
  frequenceMinutes: number;
}

/**
 * Identite de la plateforme (nom, logo, coordonnees). Editee par le
 * super-admin ; consommee par le web (landing, auth, footer, onglet), les
 * e-mails, les SMS/USSD et la documentation API. Aucune de ces valeurs ne
 * doit exister en dur dans le code.
 */
export interface ParametresIdentiteView {
  /** Nom affiche partout (ex. « KÈNÈYA »). */
  nom: string;
  /** Nom sans accent ni caracteres speciaux, pour les SMS et l'USSD (alphabet GSM). Derive du nom si vide. */
  nomCourt: string;
  slogan: string;
  /** URL absolue du logo televerse (vide = pas de logo, le nom est affiche seul). */
  logoUrl: string;
  adresse: string;
  ville: string;
  pays: string;
  telephone: string;
  telephoneSupport: string;
  emailContact: string;
  emailSupport: string;
  /** Nom d'expediteur des e-mails ; l'adresse reste celle du compte SMTP. */
  emailExpediteur: string;
  siteWeb: string;
  facebook: string;
  whatsapp: string;
  /** Mention de pied de page ; vide = « © <annee> <nom> — Tous droits reserves ». */
  copyright: string;
  /** Code ISO 4217 de la devise affichee (ex. GNF). */
  devise: string;
}

/**
 * GET /parametres/publics — sous-ensemble sans authentification, lu par le
 * web au demarrage (landing, pages d'auth, footer, titre d'onglet).
 */
export type IdentitePlateformeView = ParametresIdentiteView;

/** Valeurs persistees, toujours completes (defauts fusionnes cote serveur). */
/**
 * Duree de validite d'une ordonnance. Le cahier des charges en fait un
 * parametre administrable (decision D2 en attente) : jamais une constante.
 */
export interface ParametresPrescriptionView {
  /** Jours de validite a compter de la signature. */
  dureeValiditeJours: number;
  /** Longueur du code de verification remis au patient. */
  longueurCodeVerification: number;
  /**
   * Decision D2, non tranchee : faut-il la signature d'un medecin pour qu'une
   * ordonnance soit delivrable ? Tant qu'elle ne l'est pas, une ordonnance
   * redigee par un ASC et cloturee reste delivrable (`false`), ce qui est le
   * fonctionnement actuel sur le terrain. Passer a `true` impose la validation
   * medecin avant tout passage en pharmacie.
   */
  signatureObligatoire: boolean;

  /**
   * EF-05-12 : validite d'une ordonnance portant un produit a circuit
   * reglemente (stupefiant, psychotrope). Toujours plus courte que la duree
   * ordinaire ; la signature d'un medecin y est exigee quoi qu'il arrive.
   */
  dureeValiditeReglementeJours: number;

  /** EF-05-09 : plafond de renouvellements qu'un prescripteur peut accorder. */
  renouvellementsMax: number;
}

export interface ParametresSystemeValeurs {
  identite: ParametresIdentiteView;
  facturation: ParametresFacturationView;
  securite: ParametresSecuriteView;
  alertes: ParametresAlertesView;
  sync: ParametresSyncView;
  prescription: ParametresPrescriptionView;
}

/** GET/PUT /admin-structure/parametres */
export interface ParametresSystemeView extends ParametresSystemeValeurs {
  modifieLe: HorodatageApi | null;
  idModifiePar: string | null;
}

/** PUT /admin-structure/parametres — chaque section et chaque champ est optionnel. */
export interface UpdateParametresSystemeDto {
  identite?: Partial<ParametresIdentiteView>;
  facturation?: Partial<ParametresFacturationView>;
  securite?: Partial<ParametresSecuriteView>;
  alertes?: Partial<ParametresAlertesView>;
  sync?: Partial<ParametresSyncView>;
  prescription?: Partial<ParametresPrescriptionView>;
}

/** POST /admin-structure/parametres/logo — reponse. */
export interface LogoPlateformeView {
  logoUrl: string;
}

// ═══════════════════════════════════════════════════════════════════
// P1 — Hopital : episode de soins et demande d'analyse (EF-03)
// Routes /hopital/* (AGENT_ACCUEIL, MEDECIN, ADMIN_STRUCTURE) et /patients/me/episodes.
// ═══════════════════════════════════════════════════════════════════

/** GET /hopital/patients/recherche — identite minimale pour l'identito-vigilance (EF-03-01). */
export interface PatientRechercheView {
  id: string;
  prenom: string;
  nom: string;
  sexe: string;
  dateNaissance: HorodatageApi;
  prefecture: string;
  /** Masque sauf les 3 derniers chiffres. */
  telephoneMasque: string;
  /** Un episode ouvert existe deja dans la structure de l'agent. */
  episodeOuvert: { id: string; numero: string } | null;
}

export interface PersonneRefView {
  id: string;
  prenom: string;
  nom: string;
  role: Role;
}

export interface StructureRefView {
  id: string;
  nom: string;
  type: TypeStructure;
  prefecture: string;
}

/** Referentiel des examens (codes LOINC). */
export interface ExamenView {
  id: string;
  codeLoinc: string;
  libelle: string;
  categorie: string;
  specimen: string;
  unite: string | null;
  aJeun: boolean;
  consignes: string | null;
  prixGnf: number | null;
  /** Valeurs de reference et seuils critiques (EF-04-04, EF-04-07). */
  refMin: number | null;
  refMax: number | null;
  refTexte: string | null;
  critiqueMin: number | null;
  critiqueMax: number | null;
}

/** Resultat d'une ligne (EF-04-04). Absent tant que rien n'est saisi. */
export interface ResultatAnalyseView {
  id: string;
  valeur: string;
  valeurNumerique: number | null;
  unite: string | null;
  refMin: number | null;
  refMax: number | null;
  refTexte: string | null;
  interpretation: InterpretationResultat;
  commentaire: string | null;
  saisiLe: HorodatageApi;
  saisiPar: PersonneRefView;
  codeEchantillon: string | null;
}

export interface LigneDemandeAnalyseView {
  id: string;
  examen: ExamenView;
  commentaire: string | null;
  resultat: ResultatAnalyseView | null;
}

/** Echantillon code (EF-04-03). */
export interface EchantillonView {
  id: string;
  code: string;
  specimen: string;
  preleveLe: HorodatageApi;
  commentaire: string | null;
  preleveur: PersonneRefView;
}

export interface DemandeAnalyseView {
  id: string;
  numero: string;
  urgence: Urgence;
  statut: StatutDemandeAnalyse;
  indicationClinique: string | null;
  consignesPatient: string | null;
  creeLe: HorodatageApi;
  transmiseLe: HorodatageApi | null;
  annuleeLe: HorodatageApi | null;
  motifAnnulation: string | null;
  idEpisode: string;
  numeroEpisode: string;
  patient: { id: string; prenom: string; nom: string };
  prescripteur: PersonneRefView;
  laboratoire: StructureRefView;
  lignes: LigneDemandeAnalyseView[];
  /** Cycle laboratoire (EF-04). */
  lieuPrelevement: LieuPrelevement | null;
  creneauPrelevement: HorodatageApi | null;
  recueLe: HorodatageApi | null;
  preleveeLe: HorodatageApi | null;
  valideeLe: HorodatageApi | null;
  valideur: PersonneRefView | null;
  commentaireBiologiste: string | null;
  /** Null tant que les resultats ne sont pas diffuses au patient (EF-04-09). */
  diffuseePatientLe: HorodatageApi | null;
  echantillons: EchantillonView[];
  /** Au moins un resultat critique non accuse par le prescripteur. */
  alerteCritiqueEnAttente: boolean;
}

export interface RendezVousEpisodeView {
  id: string;
  statut: string;
  motif: string | null;
  prevuLe: HorodatageApi;
  medecin: PersonneRefView | null;
}

export interface EpisodeSoinsView {
  id: string;
  numero: string;
  motif: string;
  service: string | null;
  statut: StatutEpisode;
  notes: string | null;
  ouvertLe: HorodatageApi;
  closLe: HorodatageApi | null;
  patient: { id: string; prenom: string; nom: string; sexe: string; dateNaissance: HorodatageApi; telephone: string };
  structure: StructureRefView;
  ouvertPar: PersonneRefView;
  responsable: PersonneRefView | null;
  demandesAnalyse: DemandeAnalyseView[];
  rendezVous: RendezVousEpisodeView[];
  nbConsultations: number;
}

/** Ligne de liste (sans les sous-collections). */
export type EpisodeSoinsResumeView = Omit<EpisodeSoinsView, 'demandesAnalyse' | 'rendezVous'> & {
  nbDemandesAnalyse: number;
};

/** GET /hopital/tableau-de-bord (EF-03-07). */
export interface TableauDeBordHopitalView {
  episodesOuverts: number;
  episodesDuJour: number;
  demandesEnAttente: number;      // TRANSMISE ou RECUE
  demandesUrgentes: number;       // URGENT / URGENCE_VITALE non validees
  orientationsAVenir: number;     // rendez-vous medecin planifies
  parStatut: { statut: StatutEpisode; nombre: number }[];
  derniersEpisodes: EpisodeSoinsResumeView[];
}

export interface CreateEpisodeDto {
  idPatient: string;
  motif: string;
  service?: string;
  idResponsable?: string;
  notes?: string;
}

export interface UpdateEpisodeDto {
  motif?: string;
  service?: string;
  idResponsable?: string | null;
  notes?: string | null;
  statut?: Extract<StatutEpisode, 'OUVERT' | 'EN_COURS'>;
}

/** POST /hopital/episodes/:id/orientation (EF-03-05). */
export interface OrientationDto {
  service?: string;
  idMedecin?: string;
  /** ISO 8601 ; si absent, l'orientation n'ouvre pas de rendez-vous. */
  prevuLe?: string;
  motif?: string;
}

export interface CreateDemandeAnalyseDto {
  idLaboratoire: string;
  urgence?: Urgence;
  indicationClinique?: string;
  consignesPatient?: string;
  examens: { idExamen: string; commentaire?: string }[];
}

/** GET /patients/me/episodes — vue patient de son parcours hospitalier. */
export interface EpisodePatientView {
  id: string;
  numero: string;
  motif: string;
  service: string | null;
  statut: StatutEpisode;
  ouvertLe: HorodatageApi;
  closLe: HorodatageApi | null;
  structure: StructureRefView;
  responsable: PersonneRefView | null;
  demandesAnalyse: DemandeAnalyseView[];
  rendezVous: RendezVousEpisodeView[];
}

// ═══════════════════════════════════════════════════════════════════
// P2 — Laboratoire (EF-04)
// Routes /laboratoire/* (TECHNICIEN_LABO, BIOLOGISTE, ADMIN_STRUCTURE),
// /resultats/* (prescripteurs) et /patients/me/resultats/*.
// ═══════════════════════════════════════════════════════════════════

/** GET /laboratoire/tableau-de-bord. */
export interface TableauDeBordLaboView {
  aRecevoir: number;              // TRANSMISE
  aPrelever: number;              // RECUE
  enAnalyse: number;              // PRELEVEE + EN_ANALYSE
  aValider: number;               // EN_ANALYSE avec toutes les lignes renseignees
  urgentes: number;               // URGENT / URGENCE_VITALE non validees
  critiquesNonAccusees: number;
  valideesDuJour: number;
  prochainsPrelevements: DemandeAnalyseView[];
  fileUrgente: DemandeAnalyseView[];
}

/** POST /laboratoire/demandes/:id/prelevement/planifier (EF-04-02). */
export interface PlanifierPrelevementDto {
  lieu: LieuPrelevement;
  /** ISO 8601. */
  creneau?: string;
}

/** POST /laboratoire/demandes/:id/prelevement (EF-04-03). */
export interface EnregistrerPrelevementDto {
  /** Si absent : un echantillon par type de specimen de la demande. */
  echantillons?: { specimen: string; commentaire?: string }[];
  lieu?: LieuPrelevement;
}

/** Une valeur saisie ou importee (EF-04-04, EF-04-06). */
export interface SaisieResultatDto {
  /** Cible : la ligne, ou le code LOINC (import depuis un automate). */
  idLigne?: string;
  codeLoinc?: string;
  valeur: string;
  unite?: string;
  commentaire?: string;
  idEchantillon?: string;
  /** Force la lecture, sinon elle est calculee d'apres les references. */
  interpretation?: InterpretationResultat;
}

/** PUT /laboratoire/demandes/:id/resultats. */
export interface SaisirResultatsDto {
  resultats: SaisieResultatDto[];
}

/** POST /laboratoire/demandes/:id/valider (EF-04-05). */
export interface ValiderResultatsDto {
  commentaire?: string;
}

/** Alerte de resultat critique (EF-04-07/08). */
export interface AlerteCritiqueView {
  id: string;
  creeLe: HorodatageApi;
  accuseeLe: HorodatageApi | null;
  escaladeeLe: HorodatageApi | null;
  demande: { id: string; numero: string; idEpisode: string; patient: { id: string; prenom: string; nom: string }; laboratoire: StructureRefView };
  resultat: { libelle: string; codeLoinc: string; valeur: string; unite: string | null; refMin: number | null; refMax: number | null };
  destinataire: PersonneRefView;
}

/** Courbe d'evolution d'une valeur (EF-04-10). */
export interface EvolutionResultatView {
  codeLoinc: string;
  libelle: string;
  unite: string | null;
  refMin: number | null;
  refMax: number | null;
  points: { date: HorodatageApi; valeur: number; interpretation: InterpretationResultat; numeroDemande: string }[];
}

/** Examens pour lesquels le patient a au moins un resultat numerique diffuse. */
export interface ExamenSuiviView {
  codeLoinc: string;
  libelle: string;
  unite: string | null;
  nbPoints: number;
}

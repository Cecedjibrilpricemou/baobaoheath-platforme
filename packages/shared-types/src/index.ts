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
  | 'LABORATOIRE'
  // Un assureur : ses agents se connectent comme les autres (EF-09).
  | 'ASSURANCE';

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
  medicament?: { id: string; libelle: string; dci?: string | null; nomCommercial?: string | null; forme?: string | null; dosage?: string | null; estReglemente?: boolean };
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

/**
 * Ce que le catalogue peut contenir, en liste fermee (decision du 2026-10-01).
 * Porte les exclusions d'assurance. Seul `MEDICAMENT` se prescrit.
 */
export type CategorieProduit =
  | 'MEDICAMENT'
  | 'LAIT_INFANTILE'
  | 'COMPLEMENT_ALIMENTAIRE'
  | 'COSMETIQUE'
  | 'HYGIENE'
  | 'PARAPHARMACIE'
  | 'DISPOSITIF_MEDICAL'
  | 'AUTRE';

export interface MedicamentView {
  id: string;
  /** Le nom a afficher, quelle que soit la categorie. Toujours present. */
  libelle: string;
  categorie: CategorieProduit;
  /**
   * DCI, forme et dosage n'existent que pour un medicament : un lait infantile
   * n'en a pas. La contrainte SQL `medicaments_medicament_complet` garantit
   * qu'un `MEDICAMENT` les porte toutes les trois.
   */
  dci?: string | null;
  nomCommercial?: string | null;
  forme?: string | null;
  dosage?: string | null;
  /**
   * EF-05-12 : circuit reglemente (stupefiant, psychotrope). L'ecran de
   * prescription le signale avant la saisie ; l'API applique la regle de toute
   * facon.
   */
  estReglemente?: boolean;
}

/**
 * Ce qu'il faut d'un produit du catalogue pour l'afficher dans une liste.
 * Remplace deux formes en ligne identiques, qui annonçaient `dci` et `dosage`
 * obligatoires alors qu'un article non medicamenteux n'en a pas.
 */
export interface ProduitResumeView {
  id: string;
  libelle: string;
  categorie: CategorieProduit;
  dci?: string | null;
  nomCommercial?: string | null;
  dosage?: string | null;
  forme?: string | null;
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
  /**
   * La peremption la plus proche parmi les lots encore en stock, puisque la
   * sortie se fait au plus proche de la date. `Stock.datePeremption` a disparu
   * le 2026-09-30 ; ce contrat l'annoncait encore, et les deux ecrans de stock
   * affichaient donc une date que l'API n'envoyait plus.
   */
  peremptionLaPlusProche?: HorodatageApi | null;
  enAlerte: boolean;
  medicament: MedicamentView & { classeTherapeutique?: string | null };
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
  /** Classe therapeutique en texte libre (« Antalgique »). Autre axe que `categorie`. */
  classeTherapeutique?: string | null;
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
  /**
   * L'identifiant du dossier. Necessaire au comptoir pour le tiers payant :
   * sans lui, un pharmacien pouvait scanner un patient sans pouvoir ensuite
   * controler son eligibilite.
   */
  id: string;
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
  /**
   * La peremption la plus proche parmi les lots encore en stock, puisque la
   * sortie se fait au plus proche de la date. `Stock.datePeremption` a disparu
   * le 2026-09-30 ; ce contrat l'annoncait encore, et les deux ecrans de stock
   * affichaient donc une date que l'API n'envoyait plus.
   */
  peremptionLaPlusProche?: HorodatageApi | null;
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

// `ConsentementView` vivait ici : c etait la ligne brute de la table. Elle est
// remplacee par la vue versionnee plus bas (EF-02-01), qui porte en plus le
// texte reellement presente et dit si l accord a seulement ete presume. Garder
// les deux aurait fait coexister deux notions de « consentement », dont une
// qui ne sait pas a quoi la personne a dit oui.

/** PUT /privacy/me/consents */
export interface SetConsentementDto {
  scope: ConsentScope;
  actif: boolean;
  source?: string;
  commentaire?: string;
}

/** GET /privacy/me/audit-logs — acces journalises au dossier du patient. */
/**
 * Une ligne du journal des acces au dossier, telle que le patient la lit
 * (EF-02-08).
 */
export interface AccesDossierView {
  id: string;
  /**
   * Le motif de route enregistre (`GET /:id`). Conserve pour une enquete ou
   * un signalement : c'est la trace technique. **Ne pas l'afficher seul** —
   * un patient ne lit pas « GET /:id ». Voir `libelle`.
   */
  action: string;
  ressource: string;
  idRessource: string | null;
  /**
   * La meme chose en mots de patient, sous forme de **cles de traduction** :
   * la phrase, et l'objet qu'elle designe.
   *
   * L'API ne rend pas de texte. L'application est bilingue — le selecteur de
   * langue est a l'ecran — et une phrase francaise figee s'afficherait telle
   * quelle a un patient ayant choisi l'anglais. La formulation vit donc dans
   * `apps/web/src/app/shared/i18n/{fr,en}.json`, comme tout le reste de
   * l'interface.
   *
   * La phrase attend un parametre `objet`, a remplacer par la traduction de
   * `libelleObjet`. Ce dernier est vide pour les phrases qui se suffisent a
   * elles-memes, comme le scan d'un code au comptoir.
   */
  libelle: string;
  libelleObjet: string;
  /**
   * `true` quand c'est le patient lui-meme qui a agi.
   *
   * Sans cette distinction, ses propres consultations noient celles des
   * tiers : dans la base de demonstration, elles representaient 273 lignes
   * sur 850.
   */
  parMoi: boolean;
  /** Le code HTTP rendu. Un refus (>= 400) est une tentative, pas un acces. */
  statutHttp: number | null;
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

/** Regles du comptoir d'officine (addendum du 2026-09-28, point 1.1). */
export interface ParametresPharmacieView {
  /**
   * Plafond de remise qu'un vendeur peut accorder, en pourcentage du brut.
   * Sans plafond, une erreur de frappe — ou une complaisance — ramene une
   * vente a zero sans que rien ne s'y oppose.
   */
  remiseMaxPourcent: number;

  /**
   * Categories soumises a ordonnance **en plus** des produits reglementes,
   * qui le sont toujours (EF-05-12).
   *
   * La question E de l'addendum — « la vente sans ordonnance est-elle
   * autorisee pour tous les produits ? » — n'est pas tranchee. La reponse
   * s'administre donc ici, comme les decisions D1 a D10, plutot que de vivre
   * en constante dans le code.
   */
  categoriesExigeantOrdonnance: CategorieProduit[];
}

export interface ParametresSystemeValeurs {
  identite: ParametresIdentiteView;
  facturation: ParametresFacturationView;
  securite: ParametresSecuriteView;
  alertes: ParametresAlertesView;
  sync: ParametresSyncView;
  prescription: ParametresPrescriptionView;
  pharmacie: ParametresPharmacieView;
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
  pharmacie?: Partial<ParametresPharmacieView>;
}

/** POST /admin-structure/parametres/logo — reponse. */
export interface LogoPlateformeView {
  logoUrl: string;
}

// ═══════════════════════════════════════════════════════════════════
// P1 — Hopital : episode de soins et demande d'analyse (EF-03)
// Routes /hopital/* (AGENT_ACCUEIL, MEDECIN, ADMIN_STRUCTURE) et /patients/me/episodes.
// ═══════════════════════════════════════════════════════════════════

/**
 * GET /medecin/orientations — un patient que l'accueil a oriente vers ce
 * medecin (EF-03-05).
 *
 * L'orientation posait `EpisodeSoins.idResponsable` et creait un rendez-vous,
 * mais rien dans l'espace medecin ne lisait l'un ni l'autre : le patient
 * etait oriente vers quelqu'un qui ne le voyait jamais arriver.
 */
export interface OrientationMedecinView {
  idEpisode: string;
  numeroEpisode: string;
  statutEpisode: StatutEpisode;
  motif: string;
  service?: string | null;
  ouvertLe: HorodatageApi;
  /** Moment ou l'orientation a ete posee. */
  orienteLe: HorodatageApi;
  patient: {
    id: string;
    prenom: string;
    nom: string;
    dateNaissance: HorodatageApi;
    sexe: string;
    telephone: string;
  };
  structure: { id: string; nom: string };
  /** Present seulement si l'accueil a propose une date. */
  rendezVous?: {
    id: string;
    prevuLe: HorodatageApi;
    statut: string;
    motif?: string | null;
  } | null;
}

/**
 * POST /medecin/resultats/:idDemande/liberer — le medecin rend les resultats
 * visibles au patient (addendum du 2026-09-28).
 *
 * Le commentaire est la « traduction » : un resultat est ecrit pour un soignant,
 * et le patient qui le lit seul ne sait pas s'il doit s'inquieter.
 */
export interface LibererResultatsDto {
  commentaire?: string;
}

/**
 * GET /laboratoire/scan/:qrCode — ce que voit le laborantin qui scanne un
 * patient au comptoir.
 *
 * Volontairement etroit : l'identite minimale et les demandes encore a traiter
 * dans SON laboratoire. Un QR est un identifiant, pas une cle du dossier
 * medical — le pharmacien qui scanne le meme code voit des ordonnances et
 * aucune analyse.
 */
export interface ScanLaboratoireView {
  patient: {
    id: string;
    prenom: string;
    nom: string;
    dateNaissance: HorodatageApi;
    sexe: string;
    telephone: string;
  };
  demandes: {
    id: string;
    numero: string;
    statut: StatutDemandeAnalyse;
    urgence: Urgence;
    creeLe: HorodatageApi;
    consignesPatient?: string | null;
    examens: string[];
    /** Au moins un examen exige d'etre a jeun : a savoir avant de prelever. */
    aJeun: boolean;
  }[];
  totalDemandes: number;
}

/** Un lot recu : une quantite, une date de peremption, une origine. */
export interface LotStockView {
  id: string;
  numeroLot?: string | null;
  /** Ce qui reste de ce lot. */
  quantite: number;
  quantiteRecue: number;
  datePeremption?: HorodatageApi | null;
  prixAchatGnf: number;
  medicament: ProduitResumeView;
}

/** POST /pharmacien/approvisionnements — une ligne de la facture. */
export interface LigneApprovisionnementDto {
  idMedicament: string;
  quantite: number;
  numeroLot?: string;
  datePeremption?: HorodatageApi;
  prixAchatGnf?: number;
  unite?: string;
}

export interface CreerApprovisionnementDto {
  fournisseur: string;
  dateFacture: HorodatageApi;
  numeroFacture?: string;
  /** Photo ou scan de la facture : la piece qui justifie l'entree. */
  justificatifUrl?: string;
  lignes: LigneApprovisionnementDto[];
}

export interface ApprovisionnementView {
  id: string;
  numero: string;
  numeroFacture?: string | null;
  fournisseur: string;
  dateFacture: HorodatageApi;
  justificatifUrl?: string | null;
  montantTotalGnf: number;
  creeLe: HorodatageApi;
  saisiPar: { id: string; prenom: string; nom: string };
  lots: LotStockView[];
}

/** GET /pharmacien/peremptions — ce qui approche de sa date, ou l'a depassee. */
export interface PeremptionProcheView {
  idLot: string;
  numeroLot?: string | null;
  quantite: number;
  datePeremption: HorodatageApi;
  /** Negatif quand la date est passee. */
  joursRestants: number;
  perime: boolean;
  unite: string;
  medicament: ProduitResumeView;
}

/** Ou en est la demande qu'un patient a faite depuis chez lui. */
export type StatutDemandeRendezVous = 'EN_ATTENTE' | 'ACCEPTEE' | 'REFUSEE' | 'ANNULEE';

/** POST /patients/me/demandes-rendez-vous — le patient demande depuis chez lui. */
export interface CreerDemandeRendezVousDto {
  motif: string;
  /** A defaut, l'etablissement prefere du dossier. */
  idStructure?: string;
  /** S'il connait un medecin ; sinon l'accueil oriente la demande. */
  idMedecin?: string;
}

/** POST /medecin/demandes/:id/accepter — accepter, c'est fixer l'heure. */
export interface AccepterDemandeRendezVousDto {
  prevuLe: HorodatageApi;
}

export interface DemandeRendezVousView {
  id: string;
  motif: string;
  statut: StatutDemandeRendezVous;
  creeLe: HorodatageApi;
  traiteeLe?: HorodatageApi | null;
  motifRefus?: string | null;
  patient: {
    id: string;
    prenom: string;
    nom: string;
    dateNaissance: HorodatageApi;
    sexe: string;
    telephone: string;
  };
  structure: { id: string; nom: string; prefecture: string };
  medecin?: { id: string; prenom: string; nom: string } | null;
  /** Rempli a l'acceptation : la demande est devenue une visite. */
  idEpisode?: string | null;
  numeroEpisode?: string | null;
}

/** Le cycle d'un rendez-vous, de la prise au depart du patient. */
export type StatutRendezVous =
  | 'PLANIFIE'
  | 'PRESENT'
  | 'EN_CONSULTATION'
  | 'TERMINE'
  | 'ABSENT'
  | 'ANNULE';

/** POST /medecin/orientations/:idEpisode/rendez-vous — le medecin pose le creneau. */
export interface FixerRendezVousDto {
  prevuLe: HorodatageApi;
  motif?: string;
}

/** GET /medecin/rendez-vous — l'agenda, par ordre chronologique. */
export interface RendezVousMedecinView {
  id: string;
  prevuLe: HorodatageApi;
  statut: StatutRendezVous;
  motif?: string | null;
  /** Moment ou l'assistante a pointe l'arrivee ; absent tant qu'il n'est pas la. */
  arriveeLe?: HorodatageApi | null;
  patient: {
    id: string;
    prenom: string;
    nom: string;
    dateNaissance: HorodatageApi;
    sexe: string;
    telephone: string;
  };
  idEpisode?: string | null;
  numeroEpisode?: string | null;
}

/** GET /hopital/presences — les patients attendus aujourd'hui, vus de l'accueil. */
export interface PresenceDuJourView {
  idRendezVous: string;
  prevuLe: HorodatageApi;
  statut: StatutRendezVous;
  arriveeLe?: HorodatageApi | null;
  patient: { id: string; prenom: string; nom: string; telephone: string };
  medecin?: { id: string; prenom: string; nom: string } | null;
  idEpisode?: string | null;
}

/** GET /medecin/resultats — la file des resultats qu'un medecin doit liberer. */
export interface ResultatALibererView {
  idDemande: string;
  numero: string;
  /** Validation par le laboratoire : c'est de ce moment que date l'attente du patient. */
  valideeLe: HorodatageApi;
  idEpisode: string;
  nbExamens: number;
  contientCritique: boolean;
  contientAnormal: boolean;
  patient: { id: string; prenom: string; nom: string };
  laboratoire: { id: string; nom: string };
}

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
  commentaireLaboratoire: string | null;
  /**
   * Traduction en langage clair, ecrite par le medecin quand il a libere les
   * resultats (addendum du 2026-09-28). C'est elle qui donne son sens au
   * chiffre : sans elle, le patient lit « Hemoglobine 6 g/dL » sans savoir
   * s'il doit s'inquieter.
   */
  commentaireMedecin: string | null;
  /** Renseigne des qu'un medecin a libere : le patient peut voir ses resultats. */
  libereePar?: { id: string; prenom: string; nom: string } | null;
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
// Routes /laboratoire/* (TECHNICIEN_LABO, ADMIN_STRUCTURE),
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


// ═══════════════════════════════════════════════════════════════════
// P6 — Vente au comptoir et tableau de bord d'officine
// Routes /pharmacien/ventes et /pharmacien/tableau-de-bord (PHARMACIEN).
// Addendum du 2026-09-28, points 1.1 et 1.2.
// ═══════════════════════════════════════════════════════════════════

/**
 * Une vente au comptoir est payee sur place : il n'y a pas d'etat « en
 * attente ». `ANNULEE` ne sert pas a un retour client — EF-07-11 l'interdit —
 * mais a corriger une erreur de saisie, et elle remet les lots consommes.
 */
export type StatutVente = 'PAYEE' | 'ANNULEE';

export interface LigneVenteView {
  id: string;
  quantite: number;
  /** Prix figes a la vente : tarif de reference plus la marge de l'officine. */
  prixUnitaireGnf: number;
  montantGnf: number;
  medicament: ProduitResumeView;
  /** Couverture figee a la vente (addendum, point 5.4). */
  couvert: boolean;
  tauxAppliquePourcent: number;
  montantAssureGnf: number;
  motifExclusion?: string | null;
}

export interface VenteComptoirView {
  id: string;
  numero: string;
  statut: StatutVente;
  montantBrutGnf: number;
  remiseGnf: number;
  montantNetGnf: number;
  /** Tiers payant : 0 sans contrat, l'assure payant alors tout. */
  montantAssureGnf: number;
  montantPatientGnf: number;
  assureur?: AssureurResumeView | null;
  modePaiement: ModePaiement;
  numeroOperateur?: string | null;
  creeLe: HorodatageApi;
  annuleeLe?: HorodatageApi | null;
  motifAnnulation?: string | null;
  vendeur: { id: string; prenom: string; nom: string };
  /** Absent pour un client de passage, qui n'a pas de dossier. */
  patient?: { id: string; prenom: string; nom: string } | null;
  /** Renseigne quand la vente sert une ordonnance. */
  numeroOrdonnance?: string | null;
  lignes: LigneVenteView[];
}

/** POST /pharmacien/ventes — une ligne du panier. */
export interface LigneVenteDto {
  idMedicament: string;
  quantite: number;
}

export interface CreerVenteDto {
  lignes: LigneVenteDto[];
  modePaiement: ModePaiement;
  /** Numero mobile money, hors paiement en especes. */
  numeroOperateur?: string;
  remiseGnf?: number;
  /** Facultatif : un passant n'a pas de dossier. */
  idPatient?: string;
  /**
   * Obligatoire si le panier contient un produit reglemente, ou d'une
   * categorie que les parametres soumettent a ordonnance.
   */
  idOrdonnance?: string;
  /**
   * Appliquer le tiers payant. Suppose `idPatient` : on ne couvre pas un
   * passant anonyme. Sans contrat utilisable, la vente est refusee plutot que
   * d'encaisser le patient a son insu.
   */
  avecAssurance?: boolean;
}

export interface AnnulerVenteDto {
  /** Motif obligatoire : une annulation sans raison n'est pas tracable. */
  motif: string;
}

/** Une ligne du classement des produits les plus vendus. */
export interface ProduitVenduView {
  medicament: ProduitResumeView;
  quantite: number;
  montantGnf: number;
}

/** Un produit dont le stock est au seuil d'alerte ou en dessous. */
export interface RuptureStockView {
  medicament: ProduitResumeView;
  quantite: number;
  seuilAlerte: number;
  unite: string;
}

/** GET /pharmacien/tableau-de-bord. */
export interface TableauDeBordOfficineView {
  /** Le jour couvert par les chiffres « du jour », au fuseau du serveur. */
  jour: HorodatageApi;
  chiffreDuJourGnf: number;
  nombreVentesDuJour: number;
  panierMoyenGnf: number;
  /** Ce que la caisse a encaisse, par moyen de paiement, sur le jour. */
  encaissementsParMode: { modePaiement: ModePaiement; montantGnf: number; nombre: number }[];
  /** Classement sur les 30 derniers jours, ventes annulees exclues. */
  produitsLesPlusVendus: ProduitVenduView[];
  ruptures: RuptureStockView[];
  /** Nombre de lots qui approchent de leur date, ou l'ont depassee. */
  lotsAPerimer: number;
}


// ═══════════════════════════════════════════════════════════════════
// P10 — Assurance et tiers payant (EF-09)
// Routes /assurance/* et /pharmacien/ventes (part assureur).
// Addendum du 2026-09-28, point 5.
// ═══════════════════════════════════════════════════════════════════

export type ModeEchangeAssureur = 'MANUEL' | 'PORTAIL' | 'API';
export type StatutContrat = 'ACTIF' | 'SUSPENDU' | 'RESILIE';

export interface AssureurResumeView {
  id: string;
  nom: string;
  /** Code court, celui qui figure sur la carte de l'assure. */
  code: string;
}

/**
 * GET/POST /assurance/eligibilite — le controle au comptoir.
 *
 * La reponse est **figee en base** : c'est elle qui justifiera le tiers
 * payant si l'assureur le conteste. Un refus porte toujours son motif, sans
 * quoi le comptoir n'aurait rien a expliquer au patient.
 */
export interface ControleEligibiliteView {
  id: string;
  eligible: boolean;
  /** Toujours renseigne quand `eligible` est faux. */
  motif?: string | null;
  numeroPolice?: string | null;
  tauxBasePourcent?: number | null;
  creeLe: HorodatageApi;
  patient: { id: string; prenom: string; nom: string };
  assureur?: AssureurResumeView | null;
}

/** Le detail de la couverture pour une ligne (addendum, point 5.4). */
export interface CouvertureLigneView {
  libelle: string;
  /** Montant de la ligne avant remise de caisse. */
  montantGnf: number;
  couvert: boolean;
  tauxAppliquePourcent: number;
  montantAssureGnf: number;
  /** Pourquoi la ligne n'est pas prise : exclusion, ou taux nul. */
  motifExclusion?: string | null;
}

/**
 * POST /assurance/simulation — ce que l'assureur prendrait, **avant**
 * paiement. « Un reste a charge sans explication se conteste au comptoir. »
 */
export interface PriseEnChargeView {
  idContrat: string;
  assureur: AssureurResumeView;
  montantNetGnf: number;
  montantAssureGnf: number;
  montantPatientGnf: number;
  /**
   * Ce qui a rabote la part de l'assureur : franchise, plafond par ligne,
   * plafond annuel. Affiche tel quel, pour que le reste a charge s'explique.
   */
  notes: string[];
  lignes: (CouvertureLigneView & { idMedicament: string })[];
}

/** POST /assurance/assureurs — creation par l'administration. */
export interface CreerAssureurDto {
  nom: string;
  code: string;
  telephone?: string;
  email?: string;
  modeEchange?: ModeEchangeAssureur;
  idStructure?: string;
}

export interface AssureurView extends AssureurResumeView {
  telephone?: string | null;
  email?: string | null;
  estActif: boolean;
  modeEchange: ModeEchangeAssureur;
  nombreContrats: number;
  regles: RegleCouvertureView[];
}

export interface RegleCouvertureView {
  id: string;
  categorie: CategorieProduit;
  exclu: boolean;
  /** Null : le taux de base du contrat s'applique. */
  tauxPourcent?: number | null;
  plafondLigneGnf: number;
  dateEffet: HorodatageApi;
}

/**
 * POST /assurance/assureurs/{id}/regles — une regle de couverture.
 *
 * Une categorie exclue n'a pas de taux : porter les deux serait
 * contradictoire, et une contrainte SQL le refuse.
 */
export interface CreerRegleCouvertureDto {
  categorie: CategorieProduit;
  exclu?: boolean;
  tauxPourcent?: number;
  plafondLigneGnf?: number;
  dateEffet?: HorodatageApi;
}

export interface CreerContratDto {
  idAssureur: string;
  idPatient: string;
  numeroPolice: string;
  tauxBasePourcent?: number;
  plafondAnnuelGnf?: number;
  franchiseGnf?: number;
  dateEffet: HorodatageApi;
  dateFin?: HorodatageApi;
  carenceJours?: number;
}

export interface ContratAssuranceView {
  id: string;
  numeroPolice: string;
  tauxBasePourcent: number;
  plafondAnnuelGnf: number;
  franchiseGnf: number;
  dateEffet: HorodatageApi;
  dateFin?: HorodatageApi | null;
  carenceJours: number;
  statut: StatutContrat;
  assureur: AssureurResumeView;
  patient: { id: string; prenom: string; nom: string };
  /** Ce que l'assureur a deja pris cette annee sur ce contrat. */
  consommeAnneeGnf: number;
}


// ═══════════════════════════════════════════════════════════════════
// P11 — Referentiels importables (EF-12-03)
// Routes /referentiels/* (ADMIN_NATIONAL, SUPER_ADMIN).
// ═══════════════════════════════════════════════════════════════════

export type TypeReferentiel = 'examens' | 'interactions' | 'medicaments';

export type StatutLigneImport = 'CREEE' | 'MISE_A_JOUR' | 'REFUSEE';

/** Le verdict d'une ligne. Aucune n'est passee sous silence. */
export interface LigneImportView {
  /** Le numero dans le fichier de l'operateur : la ligne 1 est l'en-tete. */
  ligne: number;
  /** De quoi reconnaitre la ligne : code LOINC, paire de DCI, libelle. */
  cle: string;
  statut: StatutLigneImport;
  /** Toujours renseigne quand la ligne est refusee. */
  motif?: string | null;
}

/**
 * POST /referentiels/{type}/import.
 *
 * « Un import qui echoue en silence sur trois lignes est pire que pas
 * d'import » : chaque ligne a son verdict, et `simulation` permet de tout
 * valider avant d'ecrire quoi que ce soit.
 *
 * Les lignes valides sont appliquees meme si d'autres sont refusees :
 * rejeter deux mille bonnes lignes pour trois mauvaises serait pire.
 */
export interface RapportImportView {
  type: TypeReferentiel;
  simulation: boolean;
  total: number;
  creees: number;
  misesAJour: number;
  refusees: number;
  lignes: LigneImportView[];
}

export interface ImporterReferentielDto {
  /** Le contenu du fichier CSV, tel quel. Le BOM d'Excel est tolere. */
  contenu: string;
  /** Valider sans rien ecrire. */
  simulation?: boolean;
}

/** GET /referentiels/{type}/colonnes — ce qu'un operateur doit preparer. */
export interface ColonnesReferentielView {
  type: TypeReferentiel;
  obligatoires: string[];
  facultatives: string[];
}

// --- Journal d audit : recherche et export (EF-12-05) -----------------------

/**
 * Les criteres d une recherche dans le journal d audit.
 *
 * Sans `du`, la recherche ne remonte pas au-dela de 30 jours : une requete
 * sans critere ne doit pas balayer la table entiere.
 */
export interface FiltreJournalDto {
  /** Borne basse, ISO. Par defaut : il y a 30 jours. */
  du?: string;
  /** Borne haute, ISO. Une date seule vaut la fin de la journee. */
  au?: string;
  /** L auteur de l action. */
  idUtilisateur?: string;
  /** Le patient dont le dossier a ete touche. */
  idPatient?: string;
  /** Le role de l auteur. */
  role?: Role;
  /** Le premier segment de l URL : patients, consultations, laboratoire... */
  ressource?: string;
  /** Ne garder que les refus (code HTTP >= 400) : une tentative, pas un acces. */
  echecsSeulement?: boolean;
  /** Avec `idPatient` : exclure les acces du patient a son propre dossier. */
  parTiers?: boolean;
  page?: number;
  limit?: number;
}

/** Une ligne du journal, telle qu une enquete la lit. */
export interface LigneJournalView {
  id: string;
  creeLe: HorodatageApi;
  /** La trace technique : le motif de route. */
  action: string;
  ressource: string;
  idRessource: string | null;
  /** Cles d i18n, comme pour le journal du patient. */
  libelle: string;
  libelleObjet: string;
  statutHttp: number | null;
  ipAdresse: string | null;
  idUtilisateur: string;
  acteur: { prenom: string; nom: string; role: string };
  idPatientConcerne: string | null;
  /** Nom du patient, ou null quand l action ne concernait aucun dossier. */
  patientConcerne: string | null;
}

export interface PageJournalView {
  lignes: LigneJournalView[];
  meta: PaginationMeta;
  /**
   * Au-dela de ce nombre, l export est refuse plutot que tronque : un export
   * d audit ampute sans le dire est pire qu un export absent.
   */
  maxExport: number;
}

// --- Suspension de compte (EF-12-01) ---------------------------------------

/** Ce qui a ferme un compte, quand la fermeture est documentee. */
export interface SuspensionDetail {
  suspenduLe: HorodatageApi;
  motif: string;
  /** Null si l auteur de la decision a depuis ete supprime. */
  parQui: string | null;
}

export interface CompteView {
  id: string;
  prenom: string;
  nom: string;
  email: string | null;
  telephone: string;
  role: Role;
  estActif: boolean;
  structure: string | null;
  derniereConnexion: HorodatageApi | null;
  suspension: SuspensionDetail | null;
  /**
   * Compte ferme sans date ni motif : il vient de l ancienne voie, reservee a
   * l admin de structure. On le dit plutot que de laisser croire a une
   * suspension documentee.
   */
  fermeSansMotif: boolean;
}

/** Le resultat d une suspension ou d une reactivation. */
export interface SuspensionView {
  id: string;
  nomComplet: string;
  estActif: boolean;
  motif: string | null;
  /** Ce qui a reellement ete coupe : la mesure est dite « immediate ». */
  sessionsFermees: number;
  socketsFermes: number;
}

export interface SuspendreCompteDto {
  motif: string;
}

// --- Detection d anomalies d acces (EF-12-06) ------------------------------

export type TypeAnomalie = 'REFUS_REPETES' | 'VOLUME_DOSSIERS' | 'ADRESSES_MULTIPLES';

/**
 * Les seuils de detection.
 *
 * **Ce sont des points de depart, pas des verites.** Ils n ont pas ete
 * calibres sur du trafic reel, et devront probablement varier selon le role :
 * un comptoir de pharmacie et un medecin n ont pas le meme volume normal.
 */
export interface SeuilsAnomalies {
  /** Refus d acces (401 ou 403) par le meme compte sur la fenetre. */
  refusRepetes: number;
  /** Dossiers distincts touches par le meme compte sur la fenetre. */
  dossiersDistincts: number;
  /** Adresses IP distinctes pour le meme compte sur la fenetre. */
  adressesDistinctes: number;
  fenetreHeures: number;
}

/**
 * Un signal a examiner — **pas un verdict**.
 *
 * Un soignant de garde consulte beaucoup de dossiers la nuit sans rien faire
 * de mal. Ce que porte cette vue sert a aller voir le detail dans le journal,
 * pas a decider seul.
 */
export interface AnomalieView {
  type: TypeAnomalie;
  /** `ALERTE` au-dela du triple du seuil ; `ADRESSES_MULTIPLES` reste toujours un signal. */
  gravite: 'SIGNAL' | 'ALERTE';
  idUtilisateur: string;
  acteur: string;
  role: Role | null;
  /** Faux si le compte est deja ferme : inutile de proposer de le suspendre. */
  acteurActif: boolean;
  /** Ce qui a ete mesure, et ce qui etait attendu. */
  mesure: number;
  seuil: number;
  depuis: HorodatageApi;
}

// --- Demandes d exercice de droits (EF-12-09) ------------------------------

export type TypeDemandeRgpd =
  | 'ACCES'
  | 'RECTIFICATION'
  | 'EFFACEMENT'
  | 'PORTABILITE'
  | 'OPPOSITION'
  | 'LIMITATION';

export type StatutDemandeRgpd = 'RECUE' | 'EN_COURS' | 'SATISFAITE' | 'REFUSEE';

/**
 * Une demande et ce qu elle est devenue.
 *
 * **L effacement d un dossier de soins n est pas une suppression.** Des
 * obligations de conservation s y opposent, et le journal d audit doit
 * survivre. Une demande d effacement se traite par une anonymisation de l
 * identite, ou se refuse avec son motif — jamais en silence.
 */
export interface DemandeRgpdView {
  id: string;
  type: TypeDemandeRgpd;
  statut: StatutDemandeRgpd;
  /** Ce que le patient demande, dans ses mots. */
  precision: string | null;
  creeLe: HorodatageApi;
  dateLimite: HorodatageApi;
  /** Null quand la demande est close : son delai ne court plus. */
  joursRestants: number | null;
  enRetard: boolean;
  /** La reponse ecrite. Toujours presente des que la demande est close. */
  reponse: string | null;
  traiteLe: HorodatageApi | null;
  /** Null si l agent qui a traite a depuis quitte la plateforme. */
  traitePar: string | null;
  demandeur: string;
}

export interface FileDemandesView {
  demandes: DemandeRgpdView[];
  ouvertes: number;
  enRetard: number;
  /** Le delai de reponse applique, en jours. */
  delaiJours: number;
}

export interface DeposerDemandeRgpdDto {
  type: TypeDemandeRgpd;
  /** Obligatoire pour une rectification : sans cela on ne sait pas quoi corriger. */
  precision?: string;
}

export interface RepondreDemandeRgpdDto {
  satisfaite: boolean;
  reponse: string;
}

// --- Identito-vigilance (EF-01-04/10) --------------------------------------

export type NiveauIdentite = 'PROVISOIRE' | 'VERIFIEE';

export type TypePieceIdentite =
  | 'CARTE_NATIONALE'
  | 'PASSEPORT'
  | 'ACTE_NAISSANCE'
  | 'CARTE_CONSULAIRE'
  | 'PERMIS_CONDUIRE'
  | 'AUTRE';

/**
 * L identite d un patient, telle qu un agent d accueil la voit.
 *
 * **Le niveau ne conditionne pas les soins.** Un patient provisoire est
 * consulte, suivi et prescrit normalement. Il ne verrouille que ce qui engage
 * un tiers : le tiers payant, et plus tard les produits reglementes.
 */
export interface IdentitePatientView {
  id: string;
  nomComplet: string;
  telephone: string;
  dateNaissance: HorodatageApi;
  sexe: string;
  prefecture: string;
  /** Trait distinctif. Figure sur toutes les pieces. */
  lieuNaissance: string | null;
  /** Trait distinctif le plus discriminant quand les noms se repetent. */
  nomMere: string | null;
  niveauIdentite: NiveauIdentite;
  typePiece: TypePieceIdentite | null;
  /**
   * Le numero de la piece, **masque** : il sert a prouver qu une piece a ete
   * vue, pas a etre recopie. L afficher en entier sur un ecran de comptoir,
   * devant la file d attente, serait une fuite gratuite.
   */
  numeroPieceMasque: string | null;
  verifieeLe: HorodatageApi | null;
  /** Null si l agent qui a verifie a depuis quitte la plateforme. */
  verifieePar: string | null;
  /** Les traits qui manquent encore, pour que l ecran sache quoi demander. */
  traitsManquants: string[];
}

export interface VerifierIdentiteDto {
  typePiece: TypePieceIdentite;
  numeroPiece: string;
  /** Exige : il figure sur la piece que l agent a en main. */
  lieuNaissance: string;
  /** Facultatif : absent d un passeport. */
  nomMere?: string;
  /** Confirmer le remplacement d une piece deja enregistree. */
  remplacerPiece?: boolean;
}

export interface NoterTraitsDto {
  lieuNaissance?: string;
  nomMere?: string;
}

// --- Bris de glace (EF-02-06) ----------------------------------------------

/**
 * Pourquoi la vitre a ete brisee.
 *
 * Liste **fermee** : on ne peut ni juger ni compter des motifs ecrits comme
 * chacun veut. Le texte libre vient en plus, pas a la place.
 */
export type MotifBrisDeGlace =
  /** Pronostic vital engage, decision immediate. */
  | 'URGENCE_VITALE'
  /** Le patient ne peut pas consentir : inconscient, confus, trop jeune. */
  | 'PATIENT_HORS_ETAT'
  /** Le patient est adresse par une autre structure et son dossier y vit. */
  | 'CONTINUITE_DES_SOINS'
  /** Suspicion d interaction ou d allergie a verifier avant de prescrire. */
  | 'VERIFICATION_AVANT_PRESCRIPTION'
  | 'AUTRE';

export type StatutRevueBrisDeGlace = 'A_REVOIR' | 'JUSTIFIE' | 'INJUSTIFIE';

export type MotifRefusBrisDeGlace =
  | 'PATIENT_INTROUVABLE'
  /** Seuls les roles qui donnent des soins peuvent briser la glace. */
  | 'ROLE_NON_AUTORISE'
  /** Son propre dossier est deja ouvert : le declarer serait une fausse urgence. */
  | 'SON_PROPRE_DOSSIER'
  | 'EXPLICATION_TROP_COURTE'
  | 'BRIS_INTROUVABLE'
  | 'PAS_VOTRE_ACCES'
  | 'DEJA_REFERME'
  /** Un garde-fou qu on s applique a soi-meme n en est pas un. */
  | 'PAS_SON_PROPRE_ACCES'
  | 'DEJA_REVU'
  | 'AVIS_TROP_COURT';

/**
 * Un acces en urgence, tel qu il se lit.
 *
 * **Ce n est pas un passe-partout** : un motif est exige, l acces expire, le
 * patient est prevenu, et l administration repasse derriere.
 */
export interface BrisDeGlaceView {
  id: string;
  motif: MotifBrisDeGlace;
  /** Ce que le soignant a explique en toutes lettres. Ne se reecrit pas. */
  explication: string;
  ouvertLe: HorodatageApi;
  expireLe: HorodatageApi;
  refermeLe: HorodatageApi | null;
  /** Encore ouvert : ni referme, ni expire. */
  ouvert: boolean;
  statutRevue: StatutRevueBrisDeGlace;
  avisRevue: string | null;
  revuLe: HorodatageApi | null;
  revuPar: string | null;
  /**
   * `null` : **le patient n a pas pu etre prevenu.** La declaration tient
   * quand meme — il y a un patient au bout — mais le manque se voit.
   */
  notifieLe: HorodatageApi | null;
  patient: { id: string; nomComplet: string };
  auteur: { id: string; nomComplet: string; role: string };
  structure: string | null;
}

export interface DeclarerBrisDeGlaceDto {
  idPatient: string;
  motif: MotifBrisDeGlace;
  explication: string;
}

export interface ReviserBrisDeGlaceDto {
  statut: 'JUSTIFIE' | 'INJUSTIFIE';
  avis: string;
}

// --- Consentement versionne (EF-02-01/03/07) -------------------------------

/**
 * Un texte de consentement, dans une version et une langue.
 *
 * **Un consentement ne vaut que pour ce qui a ete explique.** Garder le texte
 * exact qui etait a l ecran est ce qui permet de prouver ce qui a ete accepte,
 * et de le remontrer a l interesse.
 */
export interface TexteConsentementView {
  id: string;
  scope: ConsentScope;
  langue: string;
  version: number;
  titre: string;
  corps: string;
  publieLe: HorodatageApi | null;
  /**
   * Le texte n existe pas dans la langue du patient et lui est montre dans
   * une autre. **Le taire ferait passer pour eclaire un consentement qui ne
   * l est pas.**
   */
  dansUneAutreLangue: boolean;
}

/**
 * Ou en est le consentement par rapport au texte en vigueur.
 *
 * `JAMAIS_RECUEILLI` est le cas le plus important : l accord a ete pose sans
 * que personne ne voie rien — par le systeme a la creation du dossier, ou
 * avant le versionnage. Ce n est pas un consentement.
 */
export type EtatTexteConsentement = 'A_JOUR' | 'TEXTE_PLUS_RECENT' | 'JAMAIS_RECUEILLI';

export interface ConsentementView {
  scope: ConsentScope;
  actif: boolean;
  /** `false` : la question ne lui a jamais ete posee. */
  repondu: boolean;
  donneLe: HorodatageApi | null;
  retireLe: HorodatageApi | null;
  source: string | null;
  /** Le texte accepte, tel qu il etait — pas celui d aujourd hui. */
  texteAccepte: TexteConsentementView | null;
  texteEnVigueur: TexteConsentementView | null;
  etat: EtatTexteConsentement;
}

export type SensConsentement = 'ACCORDE' | 'RETIRE';

/** Une ligne de l historique, qui ne s efface jamais. */
export interface EvenementConsentementView {
  id: string;
  scope: ConsentScope;
  sens: SensConsentement;
  source: string;
  commentaire: string | null;
  creeLe: HorodatageApi;
  versionTexte: number | null;
  langueTexte: string | null;
  titreTexte: string | null;
  parQui: string;
}

export interface EnregistrerConsentementDto {
  scope: ConsentScope;
  accorde: boolean;
  commentaire?: string;
}

export interface PublierTexteConsentementDto {
  scope: ConsentScope;
  langue: string;
  titre: string;
  corps: string;
}

// --- Fusion de dossiers patients (EF-01-06) --------------------------------

/**
 * Pourquoi une fusion a ete refusee.
 *
 * Chacun de ces refus protege d un melange de dossiers medicaux : c est la
 * faute la plus grave que ce produit puisse commettre.
 */
export type MotifRefusFusion =
  | 'DOSSIER_INTROUVABLE'
  | 'MEME_DOSSIER'
  | 'MOTIF_TROP_COURT'
  /** L un des deux dossiers est deja fusionne : il n y a pas de chaine. */
  | 'DEJA_FUSIONNE'
  /**
   * Les deux identites sont verifiees, sur **deux pieces differentes**. Ou
   * bien ce sont deux personnes, ou bien l une des verifications est fausse.
   * Une machine ne peut pas trancher : un agent doit reprendre la piece.
   */
  | 'DEUX_PIECES_DIFFERENTES'
  | 'FUSION_INTROUVABLE'
  | 'DEJA_ANNULEE';

export type OperationFusion = 'DEPLACEMENT' | 'RESTRICTION_CONSENTEMENT';

/** Ce qu une fusion a deplace, resume par table. */
export interface LigneFusionView {
  tableCible: string;
  operation: OperationFusion;
  nombre: number;
}

/**
 * Une fusion de dossiers, telle qu un agent la lit.
 *
 * **Le dossier absorbe n est jamais supprime** : il garde son identifiant et
 * son code QR, et la fusion peut etre defaite.
 */
export interface FusionView {
  id: string;
  motif: string;
  statut: 'ACTIVE' | 'ANNULEE';
  fusionneLe: HorodatageApi;
  fusionnePar: string;
  motifAnnulation: string | null;
  annuleeLe: HorodatageApi | null;
  annuleePar: string | null;
  principal: { id: string; nomComplet: string };
  absorbe: { id: string; nomComplet: string };
  /** Resume de ce qui a bouge. C est cela qui rend la reversibilite credible. */
  lignes: LigneFusionView[];
}

export interface FusionnerDto {
  idAbsorbe: string;
  motif: string;
}

export interface AnnulerFusionDto {
  motifAnnulation: string;
}

// --- Detection de doublons (EF-01-05) --------------------------------------

/** Ce qui a fait ressembler deux dossiers. */
export type TraitConcordant =
  | 'NOM_IDENTIQUE'
  | 'NOM_PROCHE'
  /**
   * Le meme nom ecrit autrement : « Conde » et « Konde », « Diallo » et
   * « Dialo ». Les noms sont transcrits a l oreille et varient d un guichet a
   * l autre ; c est ainsi que naissent la plupart des doublons.
   */
  | 'NOM_VARIANTE' 
  | 'MERE_IDENTIQUE'
  | 'LIEU_IDENTIQUE'
  | 'DATE_IDENTIQUE'
  /**
   * Meme date, mais une date par defaut — le 1er janvier, saisi quand on
   * ignore le jour. Elle n apprend presque rien : 9 patients sur 10 la
   * portaient dans la base du 2026-10-04.
   */
  | 'DATE_PAR_DEFAUT'
  | 'TELEPHONE_IDENTIQUE'
  /**
   * Les traits concordent, mais **pas le nom**. C est la signature de deux
   * freres : meme mere, meme lieu, meme telephone familial, et pour des
   * jumeaux meme date. Le score est alors borne sous le seuil « probable » —
   * fusionner deux freres melangerait leurs dossiers medicaux.
   */
  | 'SANS_CONCORDANCE_DE_NOM'
  /**
   * Le nom concorde, mais ecrit autrement. « Aissatou » et « Aissata » :
   * variante d ecriture, ou deux soeurs ? La machine ne peut pas trancher, et
   * personne ne le peut sans regarder le dossier. Le cas remonte en tete de
   * liste, jamais annonce comme probable.
   */
  | 'ORTHOGRAPHE_A_CONFIRMER';

/**
 * Un dossier qui pourrait etre la meme personne.
 *
 * **Ce n est pas un verdict.** Un agent decide ; aucune fusion n est
 * automatique. Fusionner deux personnes distinctes melange leurs dossiers
 * medicaux, ce qui est bien plus dangereux que de laisser un doublon.
 */
export interface CandidatDoublonView {
  id: string;
  nomComplet: string;
  telephone: string;
  dateNaissance: HorodatageApi;
  lieuNaissance: string | null;
  nomMere: string | null;
  prefecture: string;
  niveauIdentite: NiveauIdentite;
  /** Somme des traits concordants. Un ordre de grandeur, pas une probabilite. */
  score: number;
  /** Au-dela du seuil : a regarder en priorite. En deca : un doute a lever. */
  probable: boolean;
  traits: TraitConcordant[];
}

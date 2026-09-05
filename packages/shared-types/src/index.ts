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
  | 'PHARMACIE';

export type StatutOrdonnance =
  | 'EN_ATTENTE'
  | 'DELIVREE'
  | 'EXPIREE'
  | 'ANNULEE';

export type Urgence = 'ROUTINE' | 'URGENT' | 'URGENCE_VITALE';

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
  | 'ALERTE_VITALE';

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

export interface UpdateConsultationDto {
  motifPrincipal?: string;
  symptomes?: string[];
  notesAsc?: string;
  protocoleUtilise?: string;
  confianceIa?: number;
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
export interface UpdateAscProfileDto {
  numeroCertification?: string;
  photoUrl?: string;
  zoneCouverture?: {
    prefecture: string;
    sousPrefectures: string[];
  };
}

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

export interface OrdonnanceView {
  id: string;
  statut: string;
  signeLe?: HorodatageApi | null;
  posologie: string;
  frequence: string;
  dureeJours: number;
  quantite?: number | null;
  instructions?: string | null;
  medicament?: { id: string; dci: string; nomCommercial?: string | null; forme: string; dosage: string };
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

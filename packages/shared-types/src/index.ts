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

export interface DiagnosticView {
  id: string;
  libelle: string;
  codeIcd11?: string;
  typeDiagnostic?: string;
  severite?: string;
  source: string;
}

export interface OrdonnanceView {
  id: string;
  statut: string;
  signeLe?: string;
  posologie: string;
  frequence: string;
  dureeJours: number;
  quantite?: number;
  instructions?: string;
  medicament?: { id: string; dci: string; nomCommercial?: string; forme: string; dosage: string };
}

export interface ConsultationView {
  id: string;
  statut: EncounterStatus;
  motifPrincipal: string;
  consulteeLE: string;
  notesAsc?: string;
  notesMedecin?: string;
  idPatient?: string;
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

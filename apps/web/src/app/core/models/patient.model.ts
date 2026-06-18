// core/models/patient.model.ts
export interface Patient {
  id: string;
  numeroPatient?: string;
  groupeSanguin?: string;
  poidsKg?: number;
  tailleCm?: number;
  allergies?: string[];
  antecedents?: string[];
  // Some endpoints return nested utilisateur, others return flat fields
  utilisateur?: {
    prenom: string;
    nom: string;
    telephone: string;
    email?: string;
    dateNaissance?: string;
    genre?: string;
    adresse?: string;
  };
  // Flat alternatives present in some search/list responses
  prenom?: string;
  nom?: string;
  telephone?: string;
  sexe?: string;
  prefecture?: string;
  idStructurePreferee?: string;
  qrCode?: string;
}

export interface PatientCreatePayload {
  prenom: string;
  nom: string;
  telephone: string;
  email?: string;
  dateNaissance: string;
  genre: string;
  adresse?: string;
  motDePasse?: string;
  groupeSanguin?: string;
  allergies?: string[];
  antecedents?: string[];
}

export interface PatientUpdatePayload extends Partial<PatientCreatePayload> {}

export interface Diagnostic {
  id: string;
  libelle: string;
  codeIcd11?: string;
  typeDiagnostic?: string;
  severite?: string;
  source: string;
}

export interface OrdonnanceLigne {
  id: string;
  posologie: string;
  frequence: string;
  dureeJours: number;
  quantite?: number;
  medicament?: { id: string; nom: string; forme?: string };
}

export interface Consultation {
  id: string;
  statut: string;
  motifPrincipal: string;
  consulteeLE: string;
  medecin?: { utilisateur: { prenom: string; nom: string } };
  asc?: { utilisateur: { prenom: string; nom: string } };
  diagnostics?: Diagnostic[];
  ordonnances?: Ordonnance[];
}

export interface Ordonnance {
  id: string;
  statut: string;
  signeLe: string;
  lignes?: OrdonnanceLigne[];
}

export interface Vaccination {
  id: string;
  nomVaccin?: string;       // mock / legacy field name
  vaccinNom?: string;       // API field name (Prisma schema)
  dateAdministration: string;
  prochaineDose?: string;   // alternative field name
  dateProchaineD?: string;  // API field name (Prisma schema)
  lieu?: string;
}

export interface Paiement {
  id: string;
  montant: number;
  devise: string;
  statut: string;
  methode: string;
  datePaiement: string;
}

export interface Consentement {
  id: string;
  typeConsentement: string;
  donneLe: string;
  retireLe?: string;
  estActif: boolean;
}

// core/models/patient.model.ts
import { ConsultationView } from '@baobaoheath/shared-types';
export type { OrdonnanceView as Ordonnance, DiagnosticView as Diagnostic } from '@baobaoheath/shared-types';

export interface Consultation extends ConsultationView {
  medecin?: { utilisateur?: { prenom: string; nom: string } };
  patient?: { utilisateur?: { prenom: string; nom: string; telephone: string } };
}

export interface Patient {
  id: string;
  numeroPatient?: string;
  groupeSanguin?: string;
  poidsKg?: number;
  tailleCm?: number;
  allergies?: string[];
  maladiesChroniques?: string[];
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
  maladiesChroniques?: string[];
}

export interface PatientUpdatePayload extends Partial<PatientCreatePayload> {}

export interface OrdonnanceLigne {
  id: string;
  posologie: string;
  frequence: string;
  dureeJours: number;
  quantite?: number;
  medicament?: { id: string; nom: string; forme?: string };
}

export interface Vaccination {
  id: string;
  nomVaccin?: string;       // legacy field name
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

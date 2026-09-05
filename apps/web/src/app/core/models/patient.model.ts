// core/models/patient.model.ts
import { ConsultationView } from '@baobaoheath/shared-types';
export type { OrdonnanceView as Ordonnance, DiagnosticView as Diagnostic } from '@baobaoheath/shared-types';

export interface Consultation extends ConsultationView {
  medecin?: { utilisateur?: { prenom: string; nom: string } };
  patient?: { utilisateur?: { prenom: string; nom: string; telephone: string } };
}

/**
 * Forme renvoyee par /patients/me (patient.service.ts : getMyProfile) :
 * les champs du profil sont a plat, l'identite est imbriquee sous
 * `utilisateur`, et `structurePreferee` est un objet complet.
 */
export interface Patient {
  id: string;
  numeroPatient?: string;
  groupeSanguin?: string;
  poidsKg?: number;
  tailleCm?: number;
  allergies?: string[];
  maladiesChroniques?: string[];
  // Champs du profil patient, toujours a plat
  dateNaissance?: string;
  sexe?: string;
  prefecture?: string;
  sousPrefecture?: string;
  village?: string;
  photoUrl?: string;
  urgenceNom?: string;
  urgenceTelephone?: string;
  qrCode?: string;
  // Identite : imbriquee ici, a plat dans les reponses de recherche
  utilisateur?: {
    prenom: string;
    nom: string;
    telephone: string;
    email?: string;
    photoUrl?: string;
    langue?: string;
  };
  prenom?: string;
  nom?: string;
  telephone?: string;
  // Modele hybride : structure de sante choisie par le patient
  idStructurePreferee?: string;
  structurePreferee?: {
    id: string;
    nom: string;
    type: string;
    prefecture: string;
    adresse?: string;
    telephone?: string;
  };
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
  nomVaccin?: string;         // legacy field name
  vaccinNom?: string;         // API field name (Prisma schema)
  administreLe?: string;      // API field name (Prisma schema)
  dateAdministration?: string; // legacy field name — jamais renvoyé par l'API
  prochaineDose?: string;     // alternative field name
  dateProchaineD?: string;    // API field name (Prisma schema)
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

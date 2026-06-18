// core/models/medecin.model.ts
import { Patient } from './patient.model';
import { Consultation } from './asc.model';

export interface MedecinStats {
  consultationsRealisees: number;
  patientsReferences: number;
  ordonnancesEmises: number;
}

export interface OrdonnanceCreationPayload {
  idConsultation: string;
  lignes: {
    idMedicament: string;
    posologie: string;
    frequence: string;
    dureeJours: number;
    instructions?: string;
  }[];
}

export interface ValidationDiagnosticPayload {
  diagnosticConfirme: string;
  commentaires?: string;
  ajustementTraitement?: string;
}

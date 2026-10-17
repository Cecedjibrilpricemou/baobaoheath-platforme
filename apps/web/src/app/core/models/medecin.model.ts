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

// `ValidationDiagnosticPayload` a ete supprime : ses trois champs
// (`diagnosticConfirme`, `commentaires`, `ajustementTraitement`) n'existaient
// sur aucun endpoint. Le contrat est `ValiderConsultationDto`
// (shared-types), que le serveur valide en `.strict()`.

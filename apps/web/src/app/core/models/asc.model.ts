// core/models/asc.model.ts
import { Patient } from './patient.model';
import { ConsultationView } from '@baobaoheath/shared-types';
export type { TriagePayload, TriageHypothese, TriageResult, Urgence } from '@baobaoheath/shared-types';

export interface Consultation extends ConsultationView {
  patient?: {
    id?: string;
    utilisateur?: { prenom: string; nom: string; telephone: string; photoUrl?: string };
    prenom?: string;
    nom?: string;
    dateNaissance?: string;
    sexe?: string;
    groupeSanguin?: string;
    allergies?: string[];
    qrCode?: string;
  };
  medecin?: { utilisateur?: { prenom: string; nom: string } };
  motif?: string;
  symptomes?: string[];
}

export interface AscStats {
  consultationsMois: number;
  alertes: number;
  referencements: number;
}

export interface ConsultationCreationPayload {
  idPatient: string;
  motifPrincipal: string;
  symptomes?: string[];
}

export interface ReferencementPayload {
  idPatient: string;
  idStructureCible: string;
  motif: string;
  degreUrgence: 'ROUTINE' | 'URGENT' | 'URGENCE_VITALE';
  notes?: string;
}


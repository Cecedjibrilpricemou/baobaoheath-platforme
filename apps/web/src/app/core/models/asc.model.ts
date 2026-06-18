// core/models/asc.model.ts
import { Patient } from './patient.model';
export type { TriagePayload, TriageHypothese, TriageResult, Urgence } from '@baobaoheath/shared-types';

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

export interface Consultation {
  id: string;
  date: string;
  motif: string;
  statut: 'TERMINEE' | 'EN_COURS' | 'PLANIFIEE' | 'ANNULEE' | 'REFERENCEE';
  diagnosticPrecoce?: string;
  traitementPropose?: string;
  codeCouleurTriage?: 'VERT' | 'ORANGE' | 'ROUGE';
  idPatient: string;
  patient?: Patient;
}

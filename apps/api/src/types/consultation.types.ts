import { EncounterStatus } from '../config/generated/client/client';

// ─── DTOs Consultation ────────────────────────────────────

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
    instructions?: string;
}

export interface ReferralDto {
    idStructureCible: string;
    urgence: 'ROUTINE' | 'URGENT' | 'URGENCE_VITALE';
    resumeClinique: string;
}

export interface ConsultationFilters {
    idPatient?: string;
    idAsc?: string;
    statut?: EncounterStatus;
    page?: number;
    limit?: number;
}
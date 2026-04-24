// ─── DTOs Médecin ─────────────────────────────────────────

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
    statut?: string;
    prefecture?: string;
    page?: number;
    limit?: number;
}

export interface SendMessageDto {
    idDestinataire: string;
    contenu: string;
    idConsultation?: string;
}
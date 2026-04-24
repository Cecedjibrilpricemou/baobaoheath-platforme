// ─── DTOs Paiements ───────────────────────────────────────

export type ModePaiement = 'ORANGE_MONEY' | 'MTN_MOMO' | 'ESPECES';

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
    statut?: string;
    modePaiement?: ModePaiement;
    page?: number;
    limit?: number;
}
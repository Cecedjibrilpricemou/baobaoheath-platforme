// ─── DTOs Analytics ───────────────────────────────────────

export interface AnalyticsFilters {
    prefecture?: string;
    debut?: string;
    fin?: string;
    annee?: number;
    mois?: number;
}

export interface HeatmapFilters {
    pathologie?: string;
    debut?: string;
    fin?: string;
}

export interface AlerteEpidemique {
    pathologie: string;
    prefecture: string;
    nombre: number;
    seuil: number;
    niveau: 'ATTENTION' | 'ALERTE' | 'URGENCE';
    dateDetection: Date;
}

export interface ExportFilters {
    format: 'JSON' | 'CSV';
    debut?: string;
    fin?: string;
    prefecture?: string;
}
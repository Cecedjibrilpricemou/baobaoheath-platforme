// ─── DTOs ASC ─────────────────────────────────────────────

export interface UpdateAscProfileDto {
    numeroCertification?: string;
    photoUrl?: string;
    zoneCouverture?: {
      prefecture: string;
      sousPrefectures: string[];
    };
  }
  
  export interface UpdateStockDto {
    quantite: number;
    unite: string;
    seuilAlerte?: number;
    datePeremption?: string;
  }
  
  export interface CreateStockDto {
    idMedicament: string;
    quantite: number;
    unite: string;
    seuilAlerte?: number;
    datePeremption?: string;
  }
  
  export interface StockFilters {
    seuilAlerte?: boolean;
    page?: number;
    limit?: number;
  }
  
  export interface RapportFilters {
    mois: number;
    annee: number;
  }
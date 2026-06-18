// core/models/admin.model.ts
export interface Structure {
  id: string;
  nom: string;
  type: string;
  prefecture: string;
  sousPrefecture?: string;
  quartier?: string;
  contact?: string;
}

export interface UtilisateurAdmin {
  id: string;
  prenom: string;
  nom: string;
  telephone: string;
  email?: string;
  role: string;
  statut: string;
  structure?: Structure;
}

export interface DashboardStatsGlobal {
  totalPatients: number;
  totalConsultations: number;
  totalOrdonnances: number;
  totalStructures: number;
  alertesActives: number;
  croissancePatients: number; // en pourcentage
}

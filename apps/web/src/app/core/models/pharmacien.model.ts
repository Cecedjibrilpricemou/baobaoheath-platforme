// core/models/pharmacien.model.ts
export interface MedicamentInfo {
  id: string;
  dci: string;
  nomCommercial?: string;
  forme: string;
  dosage: string;
}

export interface PharmacieStock {
  id: string;
  quantite: number;
  seuilAlerte: number;
  unite: string;
  prixUnitaire: number;
  dateExpiration?: string;
  medicament: MedicamentInfo;
}

export interface LigneOrdonnance {
  id: string;
  posologie: string;
  frequence: string;
  dureeJours: number;
  instructions?: string;
  statut: string;
  medicament: MedicamentInfo;
}

export interface OrdonnanceDelivrance {
  id: string;
  codeUnique: string;
  statut: string;
  creeLe: string;
  valideLe?: string;
  medecin?: { utilisateur: { prenom: string; nom: string } };
  patient: { utilisateur: { prenom: string; nom: string; telephone: string } };
  lignes: LigneOrdonnance[];
}

export interface DelivrancePayload {
  lignesDelivrees: {
    idLigneOrdonnance: string;
    quantiteDelivree: number;
    substitutId?: string; // Si remplacement
  }[];
}

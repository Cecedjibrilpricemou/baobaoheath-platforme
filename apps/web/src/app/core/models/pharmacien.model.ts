// core/models/pharmacien.model.ts
//
// Ces interfaces etaient une copie parallele du contrat, et elles avaient
// derive : `MedicamentInfo` annoncait `dci` et `dosage` obligatoires, et
// `PharmacieStock` portait `prixUnitaire` et `dateExpiration`, deux noms que
// l'API n'a jamais envoyes. C'est ce genre d'ecart qui avait vide la liste
// deroulante de l'approvisionnement sans qu'aucune erreur n'apparaisse. On
// reprend donc le contrat au lieu de le redecrire.
import type { MedicamentTarifeView, MedicamentView } from '@baobaoheath/shared-types';

/** Une entree du catalogue, telle que l'API la rend. */
export type MedicamentInfo = MedicamentView;

/** Une ligne de stock de l'officine. La peremption vit sur les lots. */
export interface PharmacieStock {
  id: string;
  quantite: number;
  seuilAlerte: number;
  unite: string;
  margeGnf: number;
  medicament: MedicamentTarifeView;
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

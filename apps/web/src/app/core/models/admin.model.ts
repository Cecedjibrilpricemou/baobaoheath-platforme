// core/models/admin.model.ts
// La forme reelle vit dans shared-types, figee par l'annotation des routes.
// L'ancienne declaration locale annoncait sousPrefecture, quartier et contact :
// aucun de ces champs n'est renvoye par l'API.
import type { StructureAdminView } from '@baobaoheath/shared-types';

export type {
  StructureAdminView as Structure,
  StructurePubliqueView,
} from '@baobaoheath/shared-types';

export interface UtilisateurAdmin {
  id: string;
  prenom: string;
  nom: string;
  telephone: string;
  email?: string;
  role: string;
  statut: string;
  structure?: StructureAdminView;
}

export interface DashboardStatsGlobal {
  totalPatients: number;
  totalConsultations: number;
  totalOrdonnances: number;
  totalStructures: number;
  alertesActives: number;
  croissancePatients: number; // en pourcentage
}

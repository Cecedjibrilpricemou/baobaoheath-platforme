// core/services/laboratoire.service.ts
// P2 — Laboratoire (EF-04) : appels /laboratoire/* (technicien, biologiste),
// /resultats/* (prescripteurs) et /patients/me/resultats/*.
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { ApiResponse } from '../models/api.model';
import { environment } from '../../../environments/environment';
import type {
  AlerteCritiqueView,
  DemandeAnalyseView,
  EnregistrerPrelevementDto,
  EvolutionResultatView,
  ExamenSuiviView,
  PlanifierPrelevementDto,
  SaisirResultatsDto,
  TableauDeBordLaboView,
  ValiderResultatsDto,
} from '@baobaoheath/shared-types';

export interface PageDemandes { items: DemandeAnalyseView[]; total: number; page: number; limit: number }

@Injectable({ providedIn: 'root' })
export class LaboratoireService {
  private api = inject(ApiService);

  tableauDeBord(): Observable<ApiResponse<TableauDeBordLaboView>> {
    return this.api.get<ApiResponse<TableauDeBordLaboView>>('/laboratoire/tableau-de-bord');
  }

  fileDesDemandes(params: { statut?: string; q?: string; page?: number; limit?: number }): Observable<ApiResponse<PageDemandes>> {
    const query: Record<string, string> = {};
    if (params.statut) query['statut'] = params.statut;
    if (params.q) query['q'] = params.q;
    if (params.page) query['page'] = String(params.page);
    if (params.limit) query['limit'] = String(params.limit);
    return this.api.get<ApiResponse<PageDemandes>>('/laboratoire/demandes', query);
  }

  getDemande(id: string): Observable<ApiResponse<DemandeAnalyseView>> {
    return this.api.get<ApiResponse<DemandeAnalyseView>>(`/laboratoire/demandes/${id}`);
  }

  accuserReception(id: string): Observable<ApiResponse<DemandeAnalyseView>> {
    return this.api.post<ApiResponse<DemandeAnalyseView>>(`/laboratoire/demandes/${id}/reception`, {});
  }

  planifierPrelevement(id: string, dto: PlanifierPrelevementDto): Observable<ApiResponse<DemandeAnalyseView>> {
    return this.api.post<ApiResponse<DemandeAnalyseView>>(`/laboratoire/demandes/${id}/prelevement/planifier`, dto);
  }

  enregistrerPrelevement(id: string, dto: EnregistrerPrelevementDto): Observable<ApiResponse<DemandeAnalyseView>> {
    return this.api.post<ApiResponse<DemandeAnalyseView>>(`/laboratoire/demandes/${id}/prelevement`, dto);
  }

  saisirResultats(id: string, dto: SaisirResultatsDto): Observable<ApiResponse<DemandeAnalyseView>> {
    return this.api.put<ApiResponse<DemandeAnalyseView>>(`/laboratoire/demandes/${id}/resultats`, dto);
  }

  validerResultats(id: string, dto: ValiderResultatsDto): Observable<ApiResponse<DemandeAnalyseView>> {
    return this.api.post<ApiResponse<DemandeAnalyseView>>(`/laboratoire/demandes/${id}/valider`, dto);
  }

  /** Compte rendu HTML servi par l'API, ouvert dans un onglet (cookies de session). */
  ouvrirCompteRendu(idDemande: string, cote: 'labo' | 'prescripteur' | 'patient' = 'labo'): void {
    const chemin = cote === 'patient'
      ? `/patients/me/demandes-analyse/${idDemande}/compte-rendu`
      : cote === 'prescripteur' ? `/resultats/demandes/${idDemande}/compte-rendu` : `/laboratoire/demandes/${idDemande}/compte-rendu`;
    window.open(`${environment.apiUrl}${chemin}`, '_blank', 'noopener');
  }

  // ── Prescripteur ────────────────────────────────────────────────────
  mesAlertes(): Observable<ApiResponse<AlerteCritiqueView[]>> {
    return this.api.get<ApiResponse<AlerteCritiqueView[]>>('/resultats/alertes');
  }

  accuserAlerte(id: string): Observable<ApiResponse<AlerteCritiqueView>> {
    return this.api.post<ApiResponse<AlerteCritiqueView>>(`/resultats/alertes/${id}/accuser`, {});
  }

  examensSuivisPatient(idPatient: string): Observable<ApiResponse<ExamenSuiviView[]>> {
    return this.api.get<ApiResponse<ExamenSuiviView[]>>(`/resultats/patients/${idPatient}/examens-suivis`);
  }

  evolutionPatient(idPatient: string, codeLoinc: string): Observable<ApiResponse<EvolutionResultatView>> {
    return this.api.get<ApiResponse<EvolutionResultatView>>(`/resultats/patients/${idPatient}/evolution`, { codeLoinc });
  }

  // ── Patient ─────────────────────────────────────────────────────────
  mesExamensSuivis(): Observable<ApiResponse<ExamenSuiviView[]>> {
    return this.api.get<ApiResponse<ExamenSuiviView[]>>('/patients/me/resultats/examens-suivis');
  }

  monEvolution(codeLoinc: string): Observable<ApiResponse<EvolutionResultatView>> {
    return this.api.get<ApiResponse<EvolutionResultatView>>('/patients/me/resultats/evolution', { codeLoinc });
  }
}

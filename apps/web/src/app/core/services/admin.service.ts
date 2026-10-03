// core/services/admin.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpResponse } from '@angular/common/http';
import type { FiltreJournalDto, PageJournalView } from '@baobaoheath/shared-types';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { UtilisateurAdmin, DashboardStatsGlobal } from '../models/admin.model';
import type {
  CreationStructureView,
  IdentitePlateformeView,
  ParametresSystemeView,
  StructureAdminView,
  StructurePubliqueView,
  UpdateParametresSystemeDto,
} from '@baobaoheath/shared-types';
import { ApiResponse, PaginatedData } from '../models/api.model';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private api = inject(ApiService);

  getDashboardStats(): Observable<ApiResponse<DashboardStatsGlobal>> {
    return this.api.get<ApiResponse<DashboardStatsGlobal>>('/admin-structure/stats');
  }

  getUtilisateurs(page = 1, limit = 20): Observable<ApiResponse<PaginatedData<UtilisateurAdmin>>> {
    return this.api.get<ApiResponse<PaginatedData<UtilisateurAdmin>>>('/admin-structure/agents', {
      page: page.toString(),
      limit: limit.toString()
    });
  }

  createUtilisateur(payload: Record<string, unknown>): Observable<ApiResponse<UtilisateurAdmin>> {
    return this.api.post<ApiResponse<UtilisateurAdmin>>('/admin-structure/agents', payload);
  }

  getStructures(page = 1, limit = 50): Observable<ApiResponse<PaginatedData<StructureAdminView>>> {
    return this.api.get<ApiResponse<PaginatedData<StructureAdminView>>>('/admin-structure/structures', {
      page: page.toString(),
      limit: limit.toString()
    });
  }

  createStructure(payload: Record<string, unknown>): Observable<ApiResponse<CreationStructureView>> {
    return this.api.post<ApiResponse<CreationStructureView>>('/admin-structure/structures', payload);
  }

  createPharmacie(payload: Record<string, unknown>): Observable<ApiResponse<unknown>> {
    return this.api.post<ApiResponse<unknown>>('/admin-structure/pharmacies', payload);
  }

  deleteStructure(id: string): Observable<ApiResponse<void>> {
    return this.api.delete<ApiResponse<void>>(`/admin-structure/structures/${id}`);
  }

  updateStructure(id: string, payload: Record<string, unknown>): Observable<ApiResponse<StructureAdminView>> {
    return this.api.put<ApiResponse<StructureAdminView>>(`/admin-structure/structures/${id}`, payload);
  }

  getPublicStructures(): Observable<ApiResponse<StructurePubliqueView[]>> {
    return this.api.get<ApiResponse<StructurePubliqueView[]>>('/admin-structure/structures/publiques');
  }

  // Parametres globaux (SUPER_ADMIN)
  getParametres(): Observable<ApiResponse<ParametresSystemeView>> {
    return this.api.get<ApiResponse<ParametresSystemeView>>('/admin-structure/parametres');
  }

  updateParametres(payload: UpdateParametresSystemeDto): Observable<ApiResponse<ParametresSystemeView>> {
    return this.api.put<ApiResponse<ParametresSystemeView>>('/admin-structure/parametres', payload);
  }

  /** Televerse le logo de la plateforme (Parametres > Identite) ; renvoie l'identite a jour. */
  uploadLogo(fichier: File): Observable<ApiResponse<IdentitePlateformeView>> {
    const formData = new FormData();
    formData.append('logo', fichier);
    return this.api.post<ApiResponse<IdentitePlateformeView>>('/admin-structure/parametres/logo', formData);
  }

  // Analytics
  getAnalyticsDashboard(params?: { prefecture?: string }): Observable<ApiResponse<unknown>> {
    const queryParams: Record<string, string> = {};
    if (params?.prefecture) queryParams['prefecture'] = params.prefecture;
    return this.api.get<ApiResponse<unknown>>('/analytics/dashboard', queryParams);
  }

  getAnalyticsHeatmap(): Observable<ApiResponse<unknown[]>> {
    return this.api.get<ApiResponse<unknown[]>>('/analytics/heatmap');
  }

  getAnalyticsAlertes(): Observable<ApiResponse<unknown[]>> {
    return this.api.get<ApiResponse<unknown[]>>('/analytics/alertes');
  }

  getAnalyticsTendances(): Observable<ApiResponse<unknown[]>> {
    return this.api.get<ApiResponse<unknown[]>>('/analytics/tendances');
  }

  getAnalyticsCouverture(): Observable<ApiResponse<unknown[]>> {
    return this.api.get<ApiResponse<unknown[]>>('/analytics/vaccinations/couverture');
  }

  exportAnalytics(format: string, periode: string): Observable<unknown> {
    return this.api.get<unknown>('/analytics/export', { format, periode });
  }

  // --- Journal d audit (EF-12-05) --------------------------------------
  //
  // Les criteres partent en chaine de requete et le schema cote API est
  // `.strict()` : un critere vide ne doit donc pas etre envoye, sinon il est
  // refuse en 400. On ne transmet que ce qui est renseigne.

  rechercherJournal(filtres: FiltreJournalDto): Observable<ApiResponse<PageJournalView>> {
    return this.api.get<ApiResponse<PageJournalView>>('/journal', enParametres(filtres));
  }

  /**
   * L export CSV, avec sa reponse entiere : le nom du fichier vient du
   * serveur (`Content-Disposition`), et non d un nom reconstruit ici.
   */
  exporterJournal(filtres: FiltreJournalDto): Observable<HttpResponse<Blob>> {
    return this.api.getFichier('/journal/export', enParametres(filtres));
  }
}

/** Les criteres renseignes, en chaines. Les vides sont ecartes. */
function enParametres(filtres: FiltreJournalDto): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [cle, valeur] of Object.entries(filtres)) {
    if (valeur === undefined || valeur === null || valeur === '' || valeur === false) continue;
    params[cle] = String(valeur);
  }
  return params;
}

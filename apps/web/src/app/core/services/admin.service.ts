// core/services/admin.service.ts
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { UtilisateurAdmin, DashboardStatsGlobal } from '../models/admin.model';
import type {
  CreationStructureView,
  StructureAdminView,
  StructurePubliqueView,
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
}

// core/services/privacy.service.ts
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type {
  AccesDossierView,
  ConsentementView,
  PaginationMeta,
  SetConsentementDto,
} from '@baobaoheath/shared-types';
import { ApiService } from './api.service';
import { ApiResponse } from '../models/api.model';

@Injectable({ providedIn: 'root' })
export class PrivacyService {
  private api = inject(ApiService);

  getMyConsents(): Observable<ApiResponse<ConsentementView[]>> {
    return this.api.get<ApiResponse<ConsentementView[]>>('/privacy/me/consents');
  }

  updateConsent(payload: SetConsentementDto): Observable<ApiResponse<ConsentementView>> {
    return this.api.put<ApiResponse<ConsentementView>>('/privacy/me/consents', payload);
  }

  // L'API renvoie { success, data, meta } a plat (pas de PaginatedData).
  getAuditLogs(page = 1, limit = 20): Observable<ApiResponse<AccesDossierView[]> & { meta?: PaginationMeta }> {
    return this.api.get<ApiResponse<AccesDossierView[]> & { meta?: PaginationMeta }>('/privacy/me/audit-logs', {
      page: page.toString(),
      limit: limit.toString()
    });
  }
}

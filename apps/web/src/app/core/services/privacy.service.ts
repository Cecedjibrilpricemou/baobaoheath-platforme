// core/services/privacy.service.ts
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Consentement } from '../models/patient.model';
import { ApiResponse } from '../models/api.model';

@Injectable({ providedIn: 'root' })
export class PrivacyService {
  private api = inject(ApiService);

  getMyConsents(): Observable<ApiResponse<Consentement[]>> {
    return this.api.get<ApiResponse<Consentement[]>>('/privacy/me/consents');
  }

  updateConsent(payload: { scope: string; actif: boolean; source: string; commentaire?: string }): Observable<ApiResponse<Consentement>> {
    return this.api.put<ApiResponse<Consentement>>('/privacy/me/consents', payload);
  }

  getAuditLogs(): Observable<ApiResponse<any[]>> {
    return this.api.get<ApiResponse<any[]>>('/privacy/me/audit-logs');
  }
}

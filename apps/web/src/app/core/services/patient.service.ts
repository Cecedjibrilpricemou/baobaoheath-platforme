// core/services/patient.service.ts
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Patient, PatientCreatePayload, PatientUpdatePayload, Consultation } from '../models/patient.model';
import { ApiResponse, PaginatedData } from '../models/api.model';

@Injectable({ providedIn: 'root' })
export class PatientService {
  private api = inject(ApiService);

  createPatient(payload: PatientCreatePayload): Observable<ApiResponse<{ patient: Patient }>> {
    return this.api.post<ApiResponse<{ patient: Patient }>>('/patients', payload);
  }

  getMe(): Observable<ApiResponse<Patient>> {
    return this.api.get<ApiResponse<Patient>>('/patients/me');
  }

  updateMe(payload: PatientUpdatePayload): Observable<ApiResponse<Patient>> {
    return this.api.put<ApiResponse<Patient>>('/patients/me', payload);
  }

  setStructurePreferee(idStructure: string | null): Observable<ApiResponse<Patient>> {
    return this.api.put<ApiResponse<Patient>>('/patients/me/structure', { idStructure });
  }

  exportDossier(): Observable<Blob> {
    return this.api.getBlob('/patients/me/export');
  }

  getPatients(page = 1, limit = 20, prefecture?: string, search?: string): Observable<ApiResponse<PaginatedData<Patient>>> {
    const params: Record<string, string> = { page: page.toString(), limit: limit.toString() };
    if (prefecture) params['prefecture'] = prefecture;
    if (search) params['search'] = search;
    return this.api.get<ApiResponse<PaginatedData<Patient>>>('/patients', params);
  }

  // L'API renvoie { success, data: Consultation[], meta } : `data` est un
  // tableau, pas une enveloppe paginee.
  getMyConsultations(limit = 5): Observable<ApiResponse<Consultation[]>> {
    return this.api.get<ApiResponse<Consultation[]>>('/patients/me/consultations', { limit: limit.toString() });
  }

  getPatientByQr(qrCode: string): Observable<ApiResponse<Patient>> {
    return this.api.get<ApiResponse<Patient>>(`/patients/qr/${qrCode}`);
  }

  getPatientById(id: string): Observable<ApiResponse<Patient>> {
    return this.api.get<ApiResponse<Patient>>(`/patients/${id}`);
  }
}

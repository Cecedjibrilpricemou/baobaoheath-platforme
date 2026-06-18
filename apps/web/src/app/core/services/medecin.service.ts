// core/services/medecin.service.ts
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Patient } from '../models/patient.model';
import { Consultation } from '../models/asc.model';
import { MedecinStats, OrdonnanceCreationPayload, ValidationDiagnosticPayload } from '../models/medecin.model';
import { ApiResponse, PaginatedData } from '../models/api.model';

@Injectable({ providedIn: 'root' })
export class MedecinService {
  private api = inject(ApiService);

  getPatientDossier(idPatient: string): Observable<ApiResponse<Patient>> {
    return this.api.get<ApiResponse<Patient>>(`/patients/${idPatient}`);
  }

  getReferencements(page = 1, limit = 20): Observable<ApiResponse<PaginatedData<Consultation>>> {
    return this.api.get<ApiResponse<PaginatedData<Consultation>>>('/medecin/referencements', {
      page: page.toString(),
      limit: limit.toString()
    });
  }

  validerConsultation(idConsultation: string, payload: ValidationDiagnosticPayload): Observable<ApiResponse<Consultation>> {
    return this.api.put<ApiResponse<Consultation>>(`/medecin/consultations/${idConsultation}/valider`, payload);
  }

  creerOrdonnance(idConsultation: string, payload: OrdonnanceCreationPayload): Observable<ApiResponse<unknown>> {
    return this.api.post<ApiResponse<unknown>>(`/consultations/${idConsultation}/ordonnances`, payload);
  }

  getStats(): Observable<ApiResponse<MedecinStats>> {
    return this.api.get<ApiResponse<MedecinStats>>('/medecin/dashboard');
  }

  getDashboard(): Observable<ApiResponse<MedecinStats>> {
    return this.api.get<ApiResponse<MedecinStats>>('/medecin/dashboard');
  }

  getConsultations(): Observable<ApiResponse<Consultation[]>> {
    return this.api.get<ApiResponse<Consultation[]>>('/medecin/consultations');
  }

  getConsultationsRecentes(): Observable<ApiResponse<Consultation[]>> {
    return this.api.get<ApiResponse<Consultation[]>>('/medecin/consultations', { limit: '5' });
  }

  getMessages(): Observable<ApiResponse<unknown[]>> {
    return this.api.get<ApiResponse<unknown[]>>('/medecin/messages');
  }

  sendMessage(payload: { idDestinataire: string; contenu: string }): Observable<ApiResponse<unknown>> {
    return this.api.post<ApiResponse<unknown>>('/medecin/messages', payload);
  }
}

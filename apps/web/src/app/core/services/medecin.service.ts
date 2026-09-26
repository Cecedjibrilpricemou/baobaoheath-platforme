// core/services/medecin.service.ts
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Patient } from '../models/patient.model';
import { Consultation } from '../models/asc.model';
import { MedecinStats, OrdonnanceCreationPayload, ValidationDiagnosticPayload } from '../models/medecin.model';
import { ApiResponse } from '../models/api.model';
import type {
  OrientationMedecinView,
  ReferencementATraiterView,
  ReferralStatus,
  RepondreReferencementDto,
} from '@baobaoheath/shared-types';

@Injectable({ providedIn: 'root' })
export class MedecinService {
  private api = inject(ApiService);

  getPatientDossier(idPatient: string): Observable<ApiResponse<Patient>> {
    return this.api.get<ApiResponse<Patient>>(`/patients/${idPatient}`);
  }

  /** Les patients que l'accueil a orientes vers ce medecin (EF-03-05). */
  getOrientations(): Observable<ApiResponse<OrientationMedecinView[]>> {
    return this.api.get<ApiResponse<OrientationMedecinView[]>>('/medecin/orientations');
  }

  // L'API renvoie { success, data: [], meta } a plat (pas de PaginatedData).
  getReferencements(page = 1, limit = 20, statut?: ReferralStatus): Observable<ApiResponse<ReferencementATraiterView[]>> {
    const params: Record<string, string> = { page: page.toString(), limit: limit.toString() };
    if (statut) params['statut'] = statut;
    return this.api.get<ApiResponse<ReferencementATraiterView[]>>('/medecin/referencements', params);
  }

  repondreReferencement(id: string, payload: RepondreReferencementDto): Observable<ApiResponse<ReferencementATraiterView>> {
    return this.api.put<ApiResponse<ReferencementATraiterView>>(`/medecin/referencements/${id}/repondre`, payload);
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

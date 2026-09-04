// core/services/asc.service.ts
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Patient } from '../models/patient.model';
import { 
  AscStats, 
  Consultation, 
  ConsultationCreationPayload, 
  ReferencementPayload, 
  TriagePayload, 
  TriageResult 
} from '../models/asc.model';
import { ApiResponse, PaginatedData } from '../models/api.model';
import { OfflineQueueService, ResultatEcriture } from './offline-queue.service';

@Injectable({ providedIn: 'root' })
export class AscService {
  private api = inject(ApiService);
  private offlineQueue = inject(OfflineQueueService);

  searchPatients(query: string): Observable<ApiResponse<Patient[]>> {
    return this.api.get<ApiResponse<Patient[]>>('/patients', { q: query });
  }

  getPatientById(id: string): Observable<ApiResponse<Patient>> {
    return this.api.get<ApiResponse<Patient>>(`/patients/${id}`);
  }

  evaluateTriage(payload: TriagePayload): Observable<ApiResponse<TriageResult>> {
    return this.api.post<ApiResponse<TriageResult>>('/triage/evaluer', payload);
  }

  /**
   * Enregistre une consultation. Hors connexion, elle est mise en file locale
   * et rejouée à la reconnexion — un ASC en zone rurale ne doit jamais perdre
   * une saisie faute de réseau.
   */
  saveConsultation(
    payload: ConsultationCreationPayload,
    libelle?: string
  ): Observable<ResultatEcriture<ApiResponse<Consultation>>> {
    return this.offlineQueue.executeOrQueue(
      this.api.post<ApiResponse<Consultation>>('/consultations', payload),
      {
        entityType: 'Consultation',
        operation: 'CREATE',
        // Forme attendue par applyMutation() côté API.
        payload: {
          idPatient: payload.idPatient,
          motifPrincipal: payload.motifPrincipal,
          symptomes: payload.symptomes ?? [],
        },
        libelle: libelle || payload.motifPrincipal,
      }
    );
  }

  referencePatient(idConsultation: string, payload: ReferencementPayload): Observable<ApiResponse<Consultation>> {
    return this.api.post<ApiResponse<Consultation>>(`/consultations/${idConsultation}/referral`, payload);
  }

  getHistoriqueConsultations(page = 1, limit = 20): Observable<ApiResponse<PaginatedData<Consultation>>> {
    return this.api.get<ApiResponse<PaginatedData<Consultation>>>('/consultations', { 
      page: page.toString(), 
      limit: limit.toString() 
    });
  }

  getStats(): Observable<ApiResponse<AscStats>> {
    return this.api.get<ApiResponse<AscStats>>('/asc/rapport');
  }

  getStocks(): Observable<ApiResponse<unknown[]>> {
    return this.api.get<ApiResponse<unknown[]>>('/asc/stocks');
  }

  updateStock(
    stockId: string,
    quantite: number,
    libelle?: string
  ): Observable<ResultatEcriture<ApiResponse<unknown>>> {
    return this.offlineQueue.executeOrQueue(
      this.api.put<ApiResponse<unknown>>(`/asc/stocks/${stockId}`, { quantite }),
      {
        entityType: 'Stock',
        operation: 'UPDATE',
        entityId: stockId,
        payload: { quantite },
        libelle: libelle || `Stock ${stockId}`,
      }
    );
  }

  getPlanning(): Observable<ApiResponse<unknown[]>> {
    return this.api.get<ApiResponse<unknown[]>>('/asc/planning');
  }
}

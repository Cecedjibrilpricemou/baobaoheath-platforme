// core/services/paiement.service.ts
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Paiement } from '../models/patient.model';
import { ApiResponse } from '../models/api.model';

@Injectable({ providedIn: 'root' })
export class PaiementService {
  private api = inject(ApiService);

  initiatePaiement(payload: { idConsultation: string; montantGnf: number; modePaiement: string; numeroOperateur?: string }): Observable<ApiResponse<Paiement>> {
    return this.api.post<ApiResponse<Paiement>>('/paiements', payload);
  }

  getHistorique(): Observable<ApiResponse<Paiement[]>> {
    return this.api.get<ApiResponse<Paiement[]>>('/paiements/historique');
  }

  getStatut(id: string): Observable<ApiResponse<Paiement>> {
    return this.api.get<ApiResponse<Paiement>>(`/paiements/${id}/statut`);
  }

  annulerPaiement(id: string): Observable<ApiResponse<Paiement>> {
    return this.api.post<ApiResponse<Paiement>>(`/paiements/${id}/annuler`, {});
  }

  confirmerPaiement(id: string, referenceOperateur: string): Observable<ApiResponse<Paiement>> {
    return this.api.post<ApiResponse<Paiement>>(`/paiements/${id}/confirmer`, { referenceOperateur });
  }
}

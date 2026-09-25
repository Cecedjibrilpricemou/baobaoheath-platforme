// core/services/pharmacien.service.ts
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { PharmacieStock, OrdonnanceDelivrance, DelivrancePayload } from '../models/pharmacien.model';
import { ApiResponse } from '../models/api.model';
import type {
  OrdonnanceEnAttenteView,
  VerificationOrdonnanceView,
  VerifierOrdonnanceDto,
} from '@baobaoheath/shared-types';

@Injectable({ providedIn: 'root' })
export class PharmacienService {
  private api = inject(ApiService);

  /** Ordonnances en attente des patients de la prefecture de la pharmacie. */
  getOrdonnancesEnAttente(): Observable<ApiResponse<OrdonnanceEnAttenteView[]>> {
    return this.api.get<ApiResponse<OrdonnanceEnAttenteView[]>>('/pharmacien/ordonnances');
  }

  scanQrCode(code: string): Observable<ApiResponse<OrdonnanceDelivrance>> {
    return this.api.get<ApiResponse<OrdonnanceDelivrance>>(`/pharmacien/scan/${code}`);
  }

  /**
   * EF-07-01 : controle d'une ordonnance papier, sans le QR du patient. La
   * reponse peut etre un refus motive (non signee, expiree, deja servie) : ce
   * n'est pas une erreur HTTP, le comptoir doit l'afficher tel quel.
   */
  verifierOrdonnance(dto: VerifierOrdonnanceDto): Observable<ApiResponse<VerificationOrdonnanceView>> {
    return this.api.post<ApiResponse<VerificationOrdonnanceView>>('/pharmacien/ordonnances/verifier', dto);
  }

  delivrerOrdonnance(idOrdonnance: string, payload: DelivrancePayload): Observable<ApiResponse<OrdonnanceDelivrance>> {
    return this.api.post<ApiResponse<OrdonnanceDelivrance>>(`/pharmacien/ordonnances/${idOrdonnance}/delivrer`, payload);
  }

  /**
   * EF-05-09 : ouvrir le cycle suivant. Le numero et le code ne changent pas —
   * c'est le meme papier que le patient represente.
   */
  renouvelerOrdonnance(idOrdonnance: string): Observable<ApiResponse<{ statut: string; renouvellementsRestants: number }>> {
    return this.api.post<ApiResponse<{ statut: string; renouvellementsRestants: number }>>(
      `/pharmacien/ordonnances/${idOrdonnance}/renouveler`, {}
    );
  }

  getStocks(): Observable<ApiResponse<PharmacieStock[]>> {
    return this.api.get<ApiResponse<PharmacieStock[]>>('/pharmacien/stocks');
  }

  getMedicaments(): Observable<ApiResponse<PharmacieStock[]>> {
    return this.api.get<ApiResponse<PharmacieStock[]>>('/pharmacien/medicaments');
  }

  reapprovisionner(payload: Record<string, unknown>): Observable<ApiResponse<PharmacieStock>> {
    return this.api.post<ApiResponse<PharmacieStock>>('/pharmacien/stocks/reapprovisionner', payload);
  }

  getAgents(): Observable<ApiResponse<unknown[]>> {
    return this.api.get<ApiResponse<unknown[]>>('/pharmacien/agents');
  }

  createAgent(payload: Record<string, unknown>): Observable<ApiResponse<unknown>> {
    return this.api.post<ApiResponse<unknown>>('/pharmacien/agents', payload);
  }
}

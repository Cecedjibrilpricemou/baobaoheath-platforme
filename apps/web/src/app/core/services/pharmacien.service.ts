// core/services/pharmacien.service.ts
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { PharmacieStock, OrdonnanceDelivrance, DelivrancePayload } from '../models/pharmacien.model';
import { ApiResponse } from '../models/api.model';

@Injectable({ providedIn: 'root' })
export class PharmacienService {
  private api = inject(ApiService);

  scanQrCode(code: string): Observable<ApiResponse<OrdonnanceDelivrance>> {
    return this.api.get<ApiResponse<OrdonnanceDelivrance>>(`/pharmacien/scan/${code}`);
  }

  delivrerOrdonnance(idOrdonnance: string, payload: DelivrancePayload): Observable<ApiResponse<OrdonnanceDelivrance>> {
    return this.api.post<ApiResponse<OrdonnanceDelivrance>>(`/pharmacien/ordonnances/${idOrdonnance}/delivrer`, payload);
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

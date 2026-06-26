// core/services/consultation.service.ts
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { ApiResponse } from '../models/api.model';
import { Consultation, Diagnostic, OrdonnanceLigne } from '../models/patient.model';
import { ConstantesVitalesView } from '@baobaoheath/shared-types';

export interface VitalsPayload {
  temperature?: number;
  poidsKg?: number;
  tailleCm?: number;
  perimetreBrachial?: number;
  tensionSystolique?: number;
  tensionDiastolique?: number;
  frequenceCardiaque?: number;
  frequenceRespiratoire?: number;
  spo2?: number;
  glycemie?: number;
}

export interface DiagnosticPayload {
  libelle: string;
  codeIcd11?: string;
  typeDiagnostic?: 'PRINCIPAL' | 'DIFFERENTIEL' | 'SECONDAIRE';
  severite?: 'LEGER' | 'MODERE' | 'SEVERE' | 'CRITIQUE';
  source: 'IA_LOCALE' | 'IA_CLAUDE' | 'MEDECIN' | 'ASC';
}

export interface OrdonnancePayload {
  idMedicament: string;
  posologie: string;
  frequence: string;
  dureeJours: number;
  quantite?: number;
  instructions?: string;
}

export interface ReferralPayload {
  idStructureCible: string;
  urgence: 'ROUTINE' | 'URGENT' | 'URGENCE_VITALE';
  resumeClinique: string;
}

@Injectable({ providedIn: 'root' })
export class ConsultationService {
  private api = inject(ApiService);

  getConsultationById(id: string): Observable<ApiResponse<Consultation>> {
    return this.api.get<ApiResponse<Consultation>>(`/consultations/${id}`);
  }

  saveVitals(id: string, payload: VitalsPayload): Observable<ApiResponse<ConstantesVitalesView>> {
    return this.api.post<ApiResponse<ConstantesVitalesView>>(`/consultations/${id}/vitals`, payload);
  }

  saveDiagnostic(id: string, payload: DiagnosticPayload): Observable<ApiResponse<Diagnostic>> {
    return this.api.post<ApiResponse<Diagnostic>>(`/consultations/${id}/diagnostics`, payload);
  }

  saveOrdonnance(id: string, payload: OrdonnancePayload): Observable<ApiResponse<OrdonnanceLigne>> {
    return this.api.post<ApiResponse<OrdonnanceLigne>>(`/consultations/${id}/ordonnances`, payload);
  }

  saveReferral(id: string, payload: ReferralPayload): Observable<ApiResponse<{ id: string; statut: string }>> {
    return this.api.post<ApiResponse<{ id: string; statut: string }>>(`/consultations/${id}/referral`, payload);
  }

  closeConsultation(id: string): Observable<ApiResponse<Consultation>> {
    return this.api.post<ApiResponse<Consultation>>(`/consultations/${id}/complete`, {});
  }
}

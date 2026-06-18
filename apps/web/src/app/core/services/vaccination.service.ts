// core/services/vaccination.service.ts
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Vaccination } from '../models/patient.model';
import { ApiResponse } from '../models/api.model';

export interface AdministrerVaccinPayload {
  idPatient: string;
  vaccinNom: string;
  codeEpi?: string;
  numeroLot?: string;
  siteInjection?: string;
  reaction?: string;
  dateProchaineD?: string;
}

export interface UpdateVaccinPayload {
  reaction?: string;
  urlCertificat?: string;
  dateProchaineD?: string;
}

export interface VaccinationStats {
  total: number;
  parVaccin: Array<{ nom: string; count: number }>;
  couverture?: number;
}

@Injectable({ providedIn: 'root' })
export class VaccinationService {
  private api = inject(ApiService);

  getMyVaccinations(): Observable<ApiResponse<Vaccination[]>> {
    return this.api.get<ApiResponse<Vaccination[]>>('/vaccinations/me');
  }

  administrerVaccin(payload: AdministrerVaccinPayload): Observable<ApiResponse<Vaccination>> {
    return this.api.post<ApiResponse<Vaccination>>('/vaccinations', payload);
  }

  getRappels(joursAvant?: number, prefecture?: string): Observable<ApiResponse<Vaccination[]>> {
    const params: Record<string, string> = {};
    if (joursAvant) params['joursAvant'] = joursAvant.toString();
    if (prefecture) params['prefecture'] = prefecture;
    return this.api.get<ApiResponse<Vaccination[]>>('/vaccinations/rappels', params);
  }

  getStats(prefecture?: string): Observable<ApiResponse<VaccinationStats>> {
    const params: Record<string, string> = {};
    if (prefecture) params['prefecture'] = prefecture;
    return this.api.get<ApiResponse<VaccinationStats>>('/vaccinations/stats', params);
  }

  getPatientCarnet(idPatient: string): Observable<ApiResponse<Vaccination[]>> {
    return this.api.get<ApiResponse<Vaccination[]>>(`/vaccinations/patient/${idPatient}`);
  }

  updateVaccination(id: string, payload: UpdateVaccinPayload): Observable<ApiResponse<Vaccination>> {
    return this.api.put<ApiResponse<Vaccination>>(`/vaccinations/${id}`, payload);
  }
}

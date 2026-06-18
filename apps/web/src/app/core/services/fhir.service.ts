import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

type FhirResource = Record<string, unknown>;

@Injectable({ providedIn: 'root' })
export class FhirService {
  private api = inject(ApiService);

  getPatientFhir(idPatient: string): Observable<FhirResource> {
    return this.api.get<FhirResource>(`/fhir/patients/${idPatient}`);
  }

  getPatientBundleFhir(idPatient: string): Observable<FhirResource> {
    return this.api.get<FhirResource>(`/fhir/patients/${idPatient}/bundle`);
  }

  getConsultationFhir(idConsultation: string): Observable<FhirResource> {
    return this.api.get<FhirResource>(`/fhir/consultations/${idConsultation}`);
  }
}

// core/services/ordonnance.service.ts
// Ordonnances vues par le patient et par son prescripteur (EF-05-07/08).
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiService } from './api.service';
import { ApiResponse } from '../models/api.model';
import type { OrdonnanceView } from '@baobaoheath/shared-types';

@Injectable({ providedIn: 'root' })
export class OrdonnanceService {
  private api = inject(ApiService);

  /** Les ordonnances du patient connecte, la plus recente d'abord. */
  mesOrdonnances(): Observable<ApiResponse<OrdonnanceView[]>> {
    return this.api.get<ApiResponse<OrdonnanceView[]>>('/ordonnances/me');
  }

  getOrdonnance(id: string): Observable<ApiResponse<OrdonnanceView>> {
    return this.api.get<ApiResponse<OrdonnanceView>>(`/ordonnances/${id}`);
  }

  /**
   * Le document est rendu par l'API (meme mise en page que le bon d'examen et
   * le compte rendu de laboratoire) : on l'ouvre dans un onglet, ou le
   * navigateur se charge de l'impression. `withCredentials` etant porte par le
   * cookie de session, une simple navigation suffit.
   */
  urlDocument(id: string): string {
    return `${environment.apiUrl}/ordonnances/${id}/document`;
  }
}

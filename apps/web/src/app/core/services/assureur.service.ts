// core/services/assureur.service.ts
//
// L'espace de la compagnie d'assurance (EF-09, addendum du 2026-09-28, 5.2).
//
// **Aucun appel ne porte d'identifiant de compagnie.** Elle se déduit côté
// serveur de la structure de l'agent connecté : l'envoyer depuis le front
// laisserait croire qu'on peut en désigner une autre, et inviterait à essayer.
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type {
  AssureView,
  CreerReglementDto,
  MonAssureurView,
  ReglementView,
  SituationPharmacieView,
} from '@baobaoheath/shared-types';
import { ApiService } from './api.service';
import { ApiResponse } from '../models/api.model';

@Injectable({ providedIn: 'root' })
export class AssureurService {
  private api = inject(ApiService);

  /** La compagnie de l'agent connecté, avec ses règles de couverture. */
  maCompagnie(): Observable<ApiResponse<MonAssureurView>> {
    return this.api.get<ApiResponse<MonAssureurView>>('/assurance/moi');
  }

  /** Ses assurés et ce qui a été pris en charge cette année. */
  mesAssures(): Observable<ApiResponse<AssureView[]>> {
    return this.api.get<ApiResponse<AssureView[]>>('/assurance/moi/assures');
  }

  /** Par officine : délivré, facturé, payé, reste dû. */
  mesPharmacies(): Observable<ApiResponse<SituationPharmacieView[]>> {
    return this.api.get<ApiResponse<SituationPharmacieView[]>>('/assurance/moi/pharmacies');
  }

  mesReglements(): Observable<ApiResponse<ReglementView[]>> {
    return this.api.get<ApiResponse<ReglementView[]>>('/assurance/moi/reglements');
  }

  enregistrerReglement(payload: CreerReglementDto): Observable<ApiResponse<ReglementView>> {
    return this.api.post<ApiResponse<ReglementView>>('/assurance/moi/reglements', payload);
  }
}

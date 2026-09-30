// core/services/pharmacien.service.ts
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { PharmacieStock, MedicamentInfo, OrdonnanceDelivrance, DelivrancePayload } from '../models/pharmacien.model';
import { ApiResponse } from '../models/api.model';
import type {
  ApprovisionnementView,
  CreerApprovisionnementDto,
  LotStockView,
  PeremptionProcheView,
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

  /**
   * Le catalogue, pas le stock. L'API rend des medicaments a plat ; cette
   * methode annoncait `PharmacieStock[]` jusqu'au 2026-09-30, et tout
   * appelant qui lisait `m.medicament` recevait `undefined` sans erreur.
   */
  getMedicaments(): Observable<ApiResponse<MedicamentInfo[]>> {
    return this.api.get<ApiResponse<MedicamentInfo[]>>('/pharmacien/medicaments');
  }

  reapprovisionner(payload: Record<string, unknown>): Observable<ApiResponse<PharmacieStock>> {
    return this.api.post<ApiResponse<PharmacieStock>>('/pharmacien/stocks/reapprovisionner', payload);
  }

  // ── Approvisionnement et peremptions (addendum, points 1.3 et 1.4) ──

  /** Enregistre une facture : chaque ligne devient un lot. */
  enregistrerApprovisionnement(dto: CreerApprovisionnementDto): Observable<ApiResponse<ApprovisionnementView>> {
    return this.api.post<ApiResponse<ApprovisionnementView>>('/pharmacien/approvisionnements', dto);
  }

  getApprovisionnements(): Observable<ApiResponse<ApprovisionnementView[]>> {
    return this.api.get<ApiResponse<ApprovisionnementView[]>>('/pharmacien/approvisionnements');
  }

  /** Les lots qui approchent de leur date, ou l'ont depassee. */
  getPeremptions(jours?: number): Observable<ApiResponse<PeremptionProcheView[]>> {
    return this.api.get<ApiResponse<PeremptionProcheView[]>>(
      '/pharmacien/peremptions', jours ? { jours: String(jours) } : undefined);
  }

  /** Les lots d'un produit, du plus proche de sa peremption au plus lointain. */
  getLots(idMedicament: string): Observable<ApiResponse<LotStockView[]>> {
    return this.api.get<ApiResponse<LotStockView[]>>(`/pharmacien/medicaments/${idMedicament}/lots`);
  }

  getAgents(): Observable<ApiResponse<unknown[]>> {
    return this.api.get<ApiResponse<unknown[]>>('/pharmacien/agents');
  }

  createAgent(payload: Record<string, unknown>): Observable<ApiResponse<unknown>> {
    return this.api.post<ApiResponse<unknown>>('/pharmacien/agents', payload);
  }
}

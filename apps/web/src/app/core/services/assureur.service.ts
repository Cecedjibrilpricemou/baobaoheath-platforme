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
  AdhesionAssuranceView,
  AssureView,
  ContratAssuranceView,
  ContratCollectifView,
  CreerAdhesionAssuranceDto,
  CreerContratCollectifDto,
  CreerContratIndividuelDto,
  CreerReglePoliceDto,
  PatientAssureurRechercheView,
  RegleCouvertureView,
  TerminerAdhesionDto,
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

  // ── Les contrats de la compagnie (lot assurance) ─────────────────

  /** Retrouver la personne a rattacher, par son numero de telephone exact. */
  rechercherPatient(telephone: string): Observable<ApiResponse<PatientAssureurRechercheView[]>> {
    return this.api.get<ApiResponse<PatientAssureurRechercheView[]>>('/assurance/moi/patients', { telephone });
  }

  creerContratIndividuel(payload: CreerContratIndividuelDto): Observable<ApiResponse<ContratAssuranceView>> {
    return this.api.post<ApiResponse<ContratAssuranceView>>('/assurance/moi/contrats', payload);
  }

  contratsCollectifs(): Observable<ApiResponse<ContratCollectifView[]>> {
    return this.api.get<ApiResponse<ContratCollectifView[]>>('/assurance/moi/contrats-collectifs');
  }

  creerContratCollectif(payload: CreerContratCollectifDto): Observable<ApiResponse<ContratCollectifView>> {
    return this.api.post<ApiResponse<ContratCollectifView>>('/assurance/moi/contrats-collectifs', payload);
  }

  renouvelerContratCollectif(idContrat: string, dateFin: string): Observable<ApiResponse<ContratCollectifView>> {
    return this.api.post<ApiResponse<ContratCollectifView>>(
      `/assurance/moi/contrats-collectifs/${idContrat}/renouveler`, { dateFin }
    );
  }

  adhesions(idContrat: string): Observable<ApiResponse<AdhesionAssuranceView[]>> {
    return this.api.get<ApiResponse<AdhesionAssuranceView[]>>(`/assurance/moi/contrats-collectifs/${idContrat}/adhesions`);
  }

  ajouterAdhesion(idContrat: string, payload: CreerAdhesionAssuranceDto): Observable<ApiResponse<AdhesionAssuranceView>> {
    return this.api.post<ApiResponse<AdhesionAssuranceView>>(
      `/assurance/moi/contrats-collectifs/${idContrat}/adhesions`, payload
    );
  }

  terminerAdhesion(idAdhesion: string, payload: TerminerAdhesionDto): Observable<ApiResponse<AdhesionAssuranceView>> {
    return this.api.post<ApiResponse<AdhesionAssuranceView>>(`/assurance/moi/adhesions/${idAdhesion}/fin`, payload);
  }

  /** Un taux, une exclusion ou un plafond propre a une police. */
  ajouterReglePolice(payload: CreerReglePoliceDto): Observable<ApiResponse<RegleCouvertureView>> {
    return this.api.post<ApiResponse<RegleCouvertureView>>('/assurance/moi/polices/regles', payload);
  }
}

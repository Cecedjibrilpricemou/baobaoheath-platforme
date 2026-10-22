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
  AjouterTravailleurDto,
  AssurerPersonneDto,
  ModifierPersonneAssureeDto,
  PersonneAssureeView,
  PersonneEnregistreeView,
  RapportImportTravailleursView,
  AssureView,
  ContratAssuranceView,
  ContratCollectifView,
  CreerContratCollectifDto,
  CreerReglePoliceDto,
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

  // ── Les personnes assurees : fiche d'identite et photo ───────────

  /** Un travailleur : sa fiche, son compte patient si besoin, et son adhesion. */
  ajouterTravailleur(idContrat: string, payload: AjouterTravailleurDto): Observable<ApiResponse<PersonneEnregistreeView>> {
    return this.api.post<ApiResponse<PersonneEnregistreeView>>(
      `/assurance/moi/contrats-collectifs/${idContrat}/travailleurs`, payload
    );
  }

  /** La liste du personnel en CSV : le rapport dit ce qu'il advient de chaque ligne. */
  importerTravailleurs(idContrat: string, contenu: string): Observable<ApiResponse<RapportImportTravailleursView>> {
    return this.api.post<ApiResponse<RapportImportTravailleursView>>(
      `/assurance/moi/contrats-collectifs/${idContrat}/import`, { contenu }
    );
  }

  /** Une personne assuree a titre individuel : fiche, compte et police. */
  assurerPersonne(payload: AssurerPersonneDto): Observable<ApiResponse<PersonneEnregistreeView>> {
    return this.api.post<ApiResponse<PersonneEnregistreeView>>('/assurance/moi/personnes', payload);
  }

  personne(idPersonne: string): Observable<ApiResponse<PersonneAssureeView>> {
    return this.api.get<ApiResponse<PersonneAssureeView>>(`/assurance/moi/personnes/${idPersonne}`);
  }

  modifierPersonne(idPersonne: string, payload: ModifierPersonneAssureeDto): Observable<ApiResponse<PersonneAssureeView>> {
    return this.api.patch<ApiResponse<PersonneAssureeView>>(`/assurance/moi/personnes/${idPersonne}`, payload);
  }

  envoyerPhoto(idPersonne: string, photo: File): Observable<ApiResponse<PersonneAssureeView>> {
    const corps = new FormData();
    corps.append('photo', photo);
    return this.api.post<ApiResponse<PersonneAssureeView>>(`/assurance/moi/personnes/${idPersonne}/photo`, corps);
  }

  photo(idPersonne: string): Observable<Blob> {
    return this.api.getBlob(`/assurance/moi/personnes/${idPersonne}/photo`);
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

  terminerAdhesion(idAdhesion: string, payload: TerminerAdhesionDto): Observable<ApiResponse<AdhesionAssuranceView>> {
    return this.api.post<ApiResponse<AdhesionAssuranceView>>(`/assurance/moi/adhesions/${idAdhesion}/fin`, payload);
  }

  /** Un taux, une exclusion ou un plafond propre a une police. */
  ajouterReglePolice(payload: CreerReglePoliceDto): Observable<ApiResponse<RegleCouvertureView>> {
    return this.api.post<ApiResponse<RegleCouvertureView>>('/assurance/moi/polices/regles', payload);
  }
}

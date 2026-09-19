// core/services/hopital.service.ts
// P1 — Hopital (EF-03) : appels /hopital/* (agent d'accueil) et /patients/me/episodes.
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { ApiResponse } from '../models/api.model';
import { environment } from '../../../environments/environment';
import type {
  CreateDemandeAnalyseDto,
  CreateEpisodeDto,
  DemandeAnalyseView,
  EpisodePatientView,
  EpisodeSoinsResumeView,
  EpisodeSoinsView,
  ExamenView,
  OrientationDto,
  PatientRechercheView,
  PersonneRefView,
  StructureRefView,
  TableauDeBordHopitalView,
  UpdateEpisodeDto,
} from '@baobaoheath/shared-types';

export interface PageEpisodes { items: EpisodeSoinsResumeView[]; total: number; page: number; limit: number }
export type MedecinRefView = PersonneRefView & { specialite: string | null };

@Injectable({ providedIn: 'root' })
export class HopitalService {
  private api = inject(ApiService);

  tableauDeBord(): Observable<ApiResponse<TableauDeBordHopitalView>> {
    return this.api.get<ApiResponse<TableauDeBordHopitalView>>('/hopital/tableau-de-bord');
  }

  rechercherPatients(q: string): Observable<ApiResponse<PatientRechercheView[]>> {
    return this.api.get<ApiResponse<PatientRechercheView[]>>('/hopital/patients/recherche', { q });
  }

  listerEpisodes(params: { statut?: string; q?: string; page?: number; limit?: number }): Observable<ApiResponse<PageEpisodes>> {
    const query: Record<string, string> = {};
    if (params.statut) query['statut'] = params.statut;
    if (params.q) query['q'] = params.q;
    if (params.page) query['page'] = String(params.page);
    if (params.limit) query['limit'] = String(params.limit);
    return this.api.get<ApiResponse<PageEpisodes>>('/hopital/episodes', query);
  }

  getEpisode(id: string): Observable<ApiResponse<EpisodeSoinsView>> {
    return this.api.get<ApiResponse<EpisodeSoinsView>>(`/hopital/episodes/${id}`);
  }

  creerEpisode(dto: CreateEpisodeDto): Observable<ApiResponse<EpisodeSoinsView>> {
    return this.api.post<ApiResponse<EpisodeSoinsView>>('/hopital/episodes', dto);
  }

  modifierEpisode(id: string, dto: UpdateEpisodeDto): Observable<ApiResponse<EpisodeSoinsView>> {
    return this.api.patch<ApiResponse<EpisodeSoinsView>>(`/hopital/episodes/${id}`, dto);
  }

  cloturerEpisode(id: string): Observable<ApiResponse<EpisodeSoinsView>> {
    return this.api.post<ApiResponse<EpisodeSoinsView>>(`/hopital/episodes/${id}/cloturer`, {});
  }

  annulerEpisode(id: string): Observable<ApiResponse<EpisodeSoinsView>> {
    return this.api.post<ApiResponse<EpisodeSoinsView>>(`/hopital/episodes/${id}/annuler`, {});
  }

  orienter(id: string, dto: OrientationDto): Observable<ApiResponse<EpisodeSoinsView>> {
    return this.api.post<ApiResponse<EpisodeSoinsView>>(`/hopital/episodes/${id}/orientation`, dto);
  }

  creerDemandeAnalyse(idEpisode: string, dto: CreateDemandeAnalyseDto): Observable<ApiResponse<DemandeAnalyseView>> {
    return this.api.post<ApiResponse<DemandeAnalyseView>>(`/hopital/episodes/${idEpisode}/demandes-analyse`, dto);
  }

  annulerDemande(id: string, motif: string): Observable<ApiResponse<DemandeAnalyseView>> {
    return this.api.post<ApiResponse<DemandeAnalyseView>>(`/hopital/demandes-analyse/${id}/annuler`, { motif });
  }

  listerExamens(): Observable<ApiResponse<ExamenView[]>> {
    return this.api.get<ApiResponse<ExamenView[]>>('/hopital/examens');
  }

  listerLaboratoires(): Observable<ApiResponse<StructureRefView[]>> {
    return this.api.get<ApiResponse<StructureRefView[]>>('/hopital/laboratoires');
  }

  listerMedecins(): Observable<ApiResponse<MedecinRefView[]>> {
    return this.api.get<ApiResponse<MedecinRefView[]>>('/hopital/medecins');
  }

  /** Bon d'examen : page HTML servie par l'API, ouverte dans un onglet (les cookies de session suivent). */
  ouvrirBonExamen(idDemande: string, cotePatient = false): void {
    const chemin = cotePatient ? `/patients/me/demandes-analyse/${idDemande}/document` : `/hopital/demandes-analyse/${idDemande}/document`;
    window.open(`${environment.apiUrl}${chemin}`, '_blank', 'noopener');
  }

  // ── Patient ──────────────────────────────────────────────────────
  mesEpisodes(): Observable<ApiResponse<EpisodePatientView[]>> {
    return this.api.get<ApiResponse<EpisodePatientView[]>>('/patients/me/episodes');
  }
}

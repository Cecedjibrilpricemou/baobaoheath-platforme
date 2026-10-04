// core/services/hopital.service.ts
// P1 — Hopital (EF-03) : appels /hopital/* (agent d'accueil) et /patients/me/episodes.
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { ApiResponse } from '../models/api.model';
import { environment } from '../../../environments/environment';
import type {
  DemandeRendezVousView,
  IdentitePatientView,
  NiveauIdentite,
  VerifierIdentiteDto,
  PresenceDuJourView,
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

  /** Demandes a distance que personne ne vise : l'accueil les oriente. */
  demandesAOrienter(): Observable<ApiResponse<DemandeRendezVousView[]>> {
    return this.api.get<ApiResponse<DemandeRendezVousView[]>>('/hopital/demandes');
  }

  orienterDemande(id: string, idMedecin: string): Observable<ApiResponse<DemandeRendezVousView>> {
    return this.api.post<ApiResponse<DemandeRendezVousView>>(`/hopital/demandes/${id}/orienter`, { idMedecin });
  }

  /** Les patients attendus aujourd'hui (addendum, point 2). */
  presencesDuJour(jour?: string): Observable<ApiResponse<PresenceDuJourView[]>> {
    return this.api.get<ApiResponse<PresenceDuJourView[]>>('/hopital/presences', jour ? { jour } : undefined);
  }

  /** L'assistante pointe l'arrivee : c'est la que l'attente commence. */
  pointerPresence(idRendezVous: string): Observable<ApiResponse<PresenceDuJourView>> {
    return this.api.post<ApiResponse<PresenceDuJourView>>(`/hopital/rendez-vous/${idRendezVous}/presence`, {});
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

  // --- Identito-vigilance (EF-01-04/10) ---------------------------------
  //
  // Verifier une identite ouvre le tiers payant. Cela ne conditionne pas les
  // soins : un patient a l'identite provisoire est recu et suivi normalement.

  identites(filtres: { q?: string; niveau?: NiveauIdentite }): Observable<ApiResponse<IdentitePatientView[]>> {
    const params: Record<string, string> = {};
    if (filtres.q) params['q'] = filtres.q;
    if (filtres.niveau) params['niveau'] = filtres.niveau;
    return this.api.get<ApiResponse<IdentitePatientView[]>>('/identites', params);
  }

  verifierIdentite(id: string, dto: VerifierIdentiteDto): Observable<ApiResponse<IdentitePatientView>> {
    return this.api.post<ApiResponse<IdentitePatientView>>(`/identites/${id}/verifier`, dto);
  }
}

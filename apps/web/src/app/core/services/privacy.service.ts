// core/services/privacy.service.ts
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type {
  AccesDossierView,
  ConsentementView,
  EvenementConsentementView,
  DemandeRgpdView,
  DeposerDemandeRgpdDto,
  PaginationMeta,
  SetConsentementDto,
} from '@baobaoheath/shared-types';
import { ApiService } from './api.service';
import { ApiResponse } from '../models/api.model';

@Injectable({ providedIn: 'root' })
export class PrivacyService {
  private api = inject(ApiService);

  getMyConsents(): Observable<ApiResponse<ConsentementView[]>> {
    return this.api.get<ApiResponse<ConsentementView[]>>('/privacy/me/consents');
  }

  updateConsent(payload: SetConsentementDto): Observable<ApiResponse<ConsentementView>> {
    return this.api.put<ApiResponse<ConsentementView>>('/privacy/me/consents', payload);
  }

  /**
   * L'histoire des decisions du patient (EF-02-07).
   *
   * **C'est elle qui donne un sens au mot « versionne »** : on y lit les
   * changements d'avis et le texte qui etait a l'ecran a chaque fois. En ajout
   * seul cote base — ni modifiable, ni effacable.
   */
  historiqueConsentements(): Observable<ApiResponse<EvenementConsentementView[]>> {
    return this.api.get<ApiResponse<EvenementConsentementView[]>>(
      '/privacy/me/consents/historique');
  }

  // L'API renvoie { success, data, meta } a plat (pas de PaginatedData).
  // `parTiers` ne garde que les acces d autrui : c est ce qu on cherche quand
  // on soupconne une anomalie. Dans la base de demonstration, les acces du
  // patient lui-meme representaient 273 lignes sur 850 — sans ce filtre, ils
  // noient les deux lignes qui comptent.
  getAuditLogs(page = 1, limit = 20, parTiers = false): Observable<ApiResponse<AccesDossierView[]> & { meta?: PaginationMeta }> {
    return this.api.get<ApiResponse<AccesDossierView[]> & { meta?: PaginationMeta }>('/privacy/me/audit-logs', {
      page: page.toString(),
      limit: limit.toString(),
      ...(parTiers ? { parTiers: 'true' } : {}),
    });
  }

  // --- Demandes d'exercice de droits (EF-12-09) -------------------------
  //
  // Deposer une demande est un droit. Rien n'est execute automatiquement :
  // l'administration nationale traite, et une reponse ecrite est obligatoire.

  mesDemandesRgpd(): Observable<ApiResponse<DemandeRgpdView[]>> {
    return this.api.get<ApiResponse<DemandeRgpdView[]>>('/privacy/me/demandes-rgpd');
  }

  deposerDemandeRgpd(dto: DeposerDemandeRgpdDto): Observable<ApiResponse<DemandeRgpdView>> {
    return this.api.post<ApiResponse<DemandeRgpdView>>('/privacy/me/demandes-rgpd', dto);
  }
}

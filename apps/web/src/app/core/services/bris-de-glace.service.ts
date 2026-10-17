import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type {
  BrisDeGlaceView, DeclarerBrisDeGlaceDto, ReviserBrisDeGlaceDto,
} from '@baobaoheath/shared-types';
import { ApiService } from './api.service';
import { ApiResponse } from '../models/api.model';

/**
 * Bris de glace : l'acces en urgence a un dossier (EF-02-06).
 *
 * **Une porte declaree vaut mieux qu'une porte derobee.** Sans elle, un
 * soignant devant un patient inconscient contournerait la regle autrement, et
 * rien n'en resterait.
 */
@Injectable({ providedIn: 'root' })
export class BrisDeGlaceService {
  private api = inject(ApiService);

  declarer(dto: DeclarerBrisDeGlaceDto): Observable<ApiResponse<BrisDeGlaceView>> {
    return this.api.post<ApiResponse<BrisDeGlaceView>>('/bris-de-glace', dto);
  }

  /** Le geste honnete quand on n'a plus besoin du dossier. */
  refermer(id: string): Observable<ApiResponse<BrisDeGlaceView>> {
    return this.api.post<ApiResponse<BrisDeGlaceView>>(`/bris-de-glace/${id}/refermer`, {});
  }

  /**
   * Un soignant ne recoit que les siens ; l'administration recoit tout.
   * C'est l'API qui en decide, pas l'ecran.
   */
  lister(aRevoirSeulement = false): Observable<ApiResponse<BrisDeGlaceView[]>> {
    const params: Record<string, string> = {};
    if (aRevoirSeulement) params['aRevoirSeulement'] = 'true';
    return this.api.get<ApiResponse<BrisDeGlaceView[]>>('/bris-de-glace', params);
  }

  reviser(id: string, dto: ReviserBrisDeGlaceDto): Observable<ApiResponse<BrisDeGlaceView>> {
    return this.api.post<ApiResponse<BrisDeGlaceView>>(`/bris-de-glace/${id}/reviser`, dto);
  }
}

import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type {
  ApiResponse,
  CreationLivreurView,
  CreerLivreurDto,
  LivreurAdminView,
} from '@baobaoheath/shared-types';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class LivreurAdminService {
  private readonly api = inject(ApiService);

  lister(): Observable<ApiResponse<LivreurAdminView[]>> {
    return this.api.get<ApiResponse<LivreurAdminView[]>>('/comptes/livreurs');
  }

  creer(dto: CreerLivreurDto): Observable<ApiResponse<CreationLivreurView>> {
    return this.api.post<ApiResponse<CreationLivreurView>>('/comptes/livreurs', dto);
  }

  definirActivite(id: string, estActif: boolean): Observable<ApiResponse<LivreurAdminView>> {
    return this.api.patch<ApiResponse<LivreurAdminView>>(`/comptes/livreurs/${id}/activite`, { estActif });
  }
}

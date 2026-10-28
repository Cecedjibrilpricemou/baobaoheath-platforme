import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type {
  AdministrateurView,
  ApiResponse,
  CreationAdministrateurView,
  CreerAdministrateurDto,
} from '@baobaoheath/shared-types';
import { ApiService } from './api.service';

/**
 * L'encadrement de la plateforme, recrute par le super administrateur seul.
 *
 * La suspension et la reactivation passent par l'ecran des comptes, qui les
 * porte deja pour tous les roles : on ne les redeclare pas ici.
 */
@Injectable({ providedIn: 'root' })
export class AdministrateurAdminService {
  private readonly api = inject(ApiService);

  lister(): Observable<ApiResponse<AdministrateurView[]>> {
    return this.api.get<ApiResponse<AdministrateurView[]>>('/comptes/administrateurs');
  }

  creer(dto: CreerAdministrateurDto): Observable<ApiResponse<CreationAdministrateurView>> {
    return this.api.post<ApiResponse<CreationAdministrateurView>>('/comptes/administrateurs', dto);
  }
}

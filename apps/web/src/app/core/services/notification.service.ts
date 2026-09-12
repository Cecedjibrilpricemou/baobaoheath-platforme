// core/services/notification.service.ts
// Notifications in-app : liste REST au chargement, puis evenement Socket.IO
// `notification:new` pour les suivantes. Le compteur non-lues est un signal
// partage par la cloche de chaque layout.
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import type {
  NotificationView,
  NotificationsNonLuesView,
  PaginatedData,
} from '@baobaoheath/shared-types';
import { ApiService } from './api.service';
import { SocketService } from './socket.service';
import { ApiResponse } from '../models/api.model';

export type { NotificationView } from '@baobaoheath/shared-types';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private api = inject(ApiService);
  private socket = inject(SocketService);

  readonly nonLues = signal(0);

  /** Flux temps reel des nouvelles notifications (deja persistees cote API). */
  readonly nouvelles$: Observable<NotificationView> = this.socket.on<NotificationView>('notification:new');

  getNotifications(page = 1, limit = 20, lu?: boolean): Observable<ApiResponse<PaginatedData<NotificationView>>> {
    const params: Record<string, string> = { page: page.toString(), limit: limit.toString() };
    if (lu !== undefined) params['lu'] = String(lu);
    return this.api.get<ApiResponse<PaginatedData<NotificationView>>>('/notifications/me', params);
  }

  rafraichirNonLues(): Observable<ApiResponse<NotificationsNonLuesView>> {
    return this.api.get<ApiResponse<NotificationsNonLuesView>>('/notifications/me/non-lues').pipe(
      tap(res => { if (res.data) this.nonLues.set(res.data.nonLues); })
    );
  }

  marquerLue(id: string): Observable<ApiResponse<NotificationView>> {
    return this.api.put<ApiResponse<NotificationView>>(`/notifications/${id}/lire`, {});
  }

  toutMarquerLu(): Observable<ApiResponse<{ marquees: number }>> {
    return this.api.put<ApiResponse<{ marquees: number }>>('/notifications/tout-lire', {}).pipe(
      tap(() => this.nonLues.set(0))
    );
  }
}

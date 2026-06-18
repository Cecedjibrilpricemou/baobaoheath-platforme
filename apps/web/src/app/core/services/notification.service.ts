import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { ApiResponse, PaginatedData } from '../models/api.model';

export interface Notification {
  id: string;
  titre: string;
  message: string;
  type: string;
  lienAction?: string;
  luLe?: string | Date;
  creeLe: string | Date;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private api = inject(ApiService);

  getNotifications(page = 1, limit = 20): Observable<ApiResponse<PaginatedData<Notification>>> {
    return this.api.get<ApiResponse<PaginatedData<Notification>>>('/notifications/me', {
      page: page.toString(),
      limit: limit.toString()
    });
  }

  getUnreadCount(): Observable<ApiResponse<{ count: number }>> {
    return this.api.get<ApiResponse<{ count: number }>>('/notifications/me/unread-count');
  }

  markAsRead(id: string): Observable<ApiResponse<Notification>> {
    return this.api.put<ApiResponse<Notification>>(`/notifications/${id}/lire`, {});
  }

  markAllAsRead(): Observable<ApiResponse<void>> {
    return this.api.put<ApiResponse<void>>('/notifications/tout-lire', {});
  }

  registerPushToken(token: string, plateforme: string): Observable<ApiResponse<void>> {
    return this.api.post<ApiResponse<void>>('/notifications/push-token', {
      token,
      plateforme
    });
  }
}

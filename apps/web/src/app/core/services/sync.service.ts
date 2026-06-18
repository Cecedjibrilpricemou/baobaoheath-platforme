import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { ApiResponse, PaginatedData } from '../models/api.model';

export interface SyncEvent {
  id: string;
  scope: string;
  entityType: string;
  entityId: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  payload: Record<string, unknown>;
  creeLe: string;
}

export interface SyncMutation {
  clientMutationId: string;
  deviceId?: string;
  entityType: string;
  entityId?: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  payload: Record<string, unknown>;
  baseVersion?: number;
}

export interface SyncError {
  clientMutationId: string;
  reason: string;
}

export interface SyncResult {
  accepted: number;
  rejected: number;
  errors?: SyncError[];
}

@Injectable({ providedIn: 'root' })
export class SyncService {
  private api = inject(ApiService);

  getChanges(since?: string, limit?: number, scope?: string): Observable<ApiResponse<PaginatedData<SyncEvent>>> {
    const params: Record<string, string> = {};
    if (since) params['since'] = since;
    if (limit) params['limit'] = limit.toString();
    if (scope) params['scope'] = scope;

    return this.api.get<ApiResponse<PaginatedData<SyncEvent>>>('/sync/changes', params);
  }

  pushMutations(mutations: SyncMutation[]): Observable<ApiResponse<SyncResult>> {
    return this.api.post<ApiResponse<SyncResult>>('/sync/mutations', { mutations });
  }
}

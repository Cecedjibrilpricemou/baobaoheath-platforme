// core/services/sync.service.ts
// Accès HTTP brut aux endpoints de synchronisation.
// La file d'attente locale et la logique de rejeu vivent dans OfflineQueueService.
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export type SyncOperation = 'CREATE' | 'UPDATE' | 'DELETE';
export type SyncMutationStatut = 'RECU' | 'TRAITE' | 'REJETE';

export interface SyncEvent {
  id: string;
  scope: string;
  entityType: string;
  entityId?: string;
  operation: SyncOperation;
  payload: Record<string, unknown>;
  version: number;
  creeLe: string;
}

/** Mutation telle qu'envoyée au serveur. */
export interface SyncMutationInput {
  clientMutationId: string;
  deviceId?: string;
  entityType: string;
  entityId?: string;
  operation: SyncOperation;
  payload: Record<string, unknown>;
  baseVersion?: number;
}

/** Mutation telle que renvoyée par le serveur après traitement. */
export interface SyncMutationResult {
  id: string;
  clientMutationId: string;
  entityType: string;
  entityId?: string;
  statut: SyncMutationStatut;
  erreur?: string | null;
  traiteLe?: string | null;
}

// Le backend répond `{ success, data, meta }` — `data` est un tableau simple,
// pas une enveloppe paginée.
export interface SyncChangesResponse {
  success: boolean;
  data: SyncEvent[];
  meta: { count: number; lastVersion: number | null; serverTime: string };
}

export interface SyncPushResponse {
  success: boolean;
  data: SyncMutationResult[];
  meta: { accepted: number; processed: number; rejected: number };
}

@Injectable({ providedIn: 'root' })
export class SyncService {
  private api = inject(ApiService);

  getChanges(since?: string, limit?: number, scope?: string): Observable<SyncChangesResponse> {
    const params: Record<string, string> = {};
    if (since) params['since'] = since;
    if (limit) params['limit'] = limit.toString();
    if (scope) params['scope'] = scope;

    return this.api.get<SyncChangesResponse>('/sync/changes', params);
  }

  pushMutations(mutations: SyncMutationInput[]): Observable<SyncPushResponse> {
    return this.api.post<SyncPushResponse>('/sync/push', { mutations });
  }
}

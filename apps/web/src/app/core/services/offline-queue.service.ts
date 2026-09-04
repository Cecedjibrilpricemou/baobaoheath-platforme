// core/services/offline-queue.service.ts
// File d'attente des écritures effectuées hors connexion.
//
// Les mutations sont persistées dans localStorage (elles doivent survivre à la
// fermeture de l'application sur un téléphone d'agent de terrain), puis
// rejouées vers POST /sync/push dès que la connexion revient. Le serveur
// déduplique sur `clientMutationId`, un rejeu accidentel est donc sans risque.
import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import {
  SyncService,
  SyncMutationInput,
  SyncOperation,
  SyncPushResponse,
} from './sync.service';

const CLE_FILE = 'bb-sync-queue';
const CLE_DEVICE = 'bb-device-id';
const CLE_DERNIERE_SYNC = 'bb-last-sync';

export interface MutationEnAttente extends SyncMutationInput {
  /** Libellé lisible affiché dans le centre de synchronisation. */
  libelle: string;
  queuedAt: string;
  statut: 'pending' | 'rejected';
  erreur?: string;
}

/**
 * Issue d'une écriture : soit elle est partie au serveur, soit elle attend
 * dans la file locale. L'appelant doit informer l'utilisateur en conséquence.
 */
export interface ResultatEcriture<T> {
  synchronise: boolean;
  data?: T;
  mutation?: MutationEnAttente;
}

export interface EnqueueInput {
  entityType: string;
  operation: SyncOperation;
  payload: Record<string, unknown>;
  entityId?: string;
  baseVersion?: number;
  libelle: string;
}

function genererId(): string {
  // randomUUID n'existe pas sur les WebViews Android anciennes encore
  // courantes sur le terrain — repli sur une génération manuelle.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`;
}

@Injectable({ providedIn: 'root' })
export class OfflineQueueService {
  private syncService = inject(SyncService);

  private readonly _file = signal<MutationEnAttente[]>(this.chargerFile());
  private readonly _isSyncing = signal(false);
  private readonly _derniereSync = signal<string | null>(localStorage.getItem(CLE_DERNIERE_SYNC));
  private readonly _derniereErreur = signal<string | null>(null);
  private readonly _isOnline = signal(navigator.onLine);

  readonly file = this._file.asReadonly();
  readonly isSyncing = this._isSyncing.asReadonly();
  readonly derniereSync = this._derniereSync.asReadonly();
  readonly derniereErreur = this._derniereErreur.asReadonly();
  readonly isOnline = this._isOnline.asReadonly();

  readonly enAttente = computed(() => this._file().filter(m => m.statut === 'pending'));
  readonly rejetees = computed(() => this._file().filter(m => m.statut === 'rejected'));
  readonly nbEnAttente = computed(() => this.enAttente().length);

  private readonly deviceId = this.chargerDeviceId();

  constructor() {
    window.addEventListener('online', () => {
      this._isOnline.set(true);
      // Rattrapage automatique dès le retour du réseau.
      if (this.nbEnAttente() > 0) this.synchroniser();
    });
    window.addEventListener('offline', () => this._isOnline.set(false));
  }

  /**
   * Exécute une écriture, avec repli sur la file locale si le réseau manque.
   *
   * Seules les pannes de connectivité déclenchent la mise en file : si le
   * serveur a répondu (4xx/5xx), il a rejeté la donnée en connaissance de
   * cause et la rejouer plus tard ne ferait que la faire rejeter à nouveau —
   * l'erreur remonte donc à l'appelant.
   */
  executeOrQueue<T>(requete$: Observable<T>, repli: EnqueueInput): Observable<ResultatEcriture<T>> {
    if (!navigator.onLine) {
      // Inutile de tenter l'appel : on file directement, sans faire patienter
      // l'agent derrière un timeout réseau.
      return of({ synchronise: false, mutation: this.enqueue(repli) });
    }

    return requete$.pipe(
      map(data => ({ synchronise: true, data }) as ResultatEcriture<T>),
      catchError((erreur: unknown) => {
        if (!this.estPanneReseau(erreur)) return throwError(() => erreur);
        return of({ synchronise: false, mutation: this.enqueue(repli) } as ResultatEcriture<T>);
      })
    );
  }

  /** Distingue « pas de réseau » d'une réponse d'erreur du serveur. */
  private estPanneReseau(erreur: unknown): boolean {
    if (!navigator.onLine) return true;
    // Angular remonte status 0 quand la requête n'a jamais abouti
    // (DNS, connexion refusée, coupure en cours de transfert).
    return erreur instanceof HttpErrorResponse && erreur.status === 0;
  }

  /** Met une écriture en file. À appeler quand une requête échoue faute de réseau. */
  enqueue(input: EnqueueInput): MutationEnAttente {
    const mutation: MutationEnAttente = {
      clientMutationId: genererId(),
      deviceId: this.deviceId,
      entityType: input.entityType,
      entityId: input.entityId,
      operation: input.operation,
      payload: input.payload,
      baseVersion: input.baseVersion,
      libelle: input.libelle,
      queuedAt: new Date().toISOString(),
      statut: 'pending',
    };
    this._file.update(f => [...f, mutation]);
    this.persister();
    return mutation;
  }

  /** Retire une mutation rejetée que l'utilisateur choisit d'abandonner. */
  retirer(clientMutationId: string): void {
    this._file.update(f => f.filter(m => m.clientMutationId !== clientMutationId));
    this.persister();
  }

  /** Pousse la file puis récupère les changements serveur. */
  async synchroniser(): Promise<void> {
    if (this._isSyncing() || !navigator.onLine) return;

    this._isSyncing.set(true);
    this._derniereErreur.set(null);
    try {
      await this.pousserFile();
      await this.recupererChangements();
      const maintenant = new Date().toISOString();
      this._derniereSync.set(maintenant);
      localStorage.setItem(CLE_DERNIERE_SYNC, maintenant);
    } catch (error: unknown) {
      this._derniereErreur.set(this.messageErreur(error));
    } finally {
      this._isSyncing.set(false);
    }
  }

  private async pousserFile(): Promise<void> {
    const aEnvoyer = this.enAttente();
    if (aEnvoyer.length === 0) return;

    const reponse = await new Promise<SyncPushResponse>((resolve, reject) => {
      this.syncService.pushMutations(aEnvoyer.map(m => this.versInput(m))).subscribe({
        next: resolve,
        error: reject,
      });
    });

    // Le serveur renvoie le statut final de chaque mutation : les traitées
    // sortent de la file, les rejetées y restent avec leur motif afin que
    // l'agent puisse corriger plutôt que de perdre la saisie en silence.
    const parId = new Map(reponse.data.map(r => [r.clientMutationId, r]));
    this._file.update(file =>
      file
        .map(m => {
          const resultat = parId.get(m.clientMutationId);
          if (!resultat) return m;
          if (resultat.statut === 'REJETE') {
            return { ...m, statut: 'rejected' as const, erreur: resultat.erreur ?? 'Rejetée par le serveur' };
          }
          return resultat.statut === 'TRAITE' ? null : m;
        })
        .filter((m): m is MutationEnAttente => m !== null)
    );
    this.persister();
  }

  private async recupererChangements(): Promise<void> {
    const since = this._derniereSync() ?? undefined;
    await new Promise<void>((resolve, reject) => {
      this.syncService.getChanges(since).subscribe({
        next: () => resolve(),
        error: reject,
      });
    });
  }

  private versInput(m: MutationEnAttente): SyncMutationInput {
    return {
      clientMutationId: m.clientMutationId,
      deviceId: m.deviceId,
      entityType: m.entityType,
      entityId: m.entityId,
      operation: m.operation,
      payload: m.payload,
      baseVersion: m.baseVersion,
    };
  }

  private messageErreur(error: unknown): string {
    const err = error as { error?: { error?: string; message?: string }; message?: string };
    return err?.error?.error ?? err?.error?.message ?? err?.message ?? 'Échec de la synchronisation';
  }

  private chargerFile(): MutationEnAttente[] {
    try {
      const brut = localStorage.getItem(CLE_FILE);
      const parsed = brut ? JSON.parse(brut) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private persister(): void {
    try {
      localStorage.setItem(CLE_FILE, JSON.stringify(this._file()));
    } catch {
      // Quota dépassé : on garde la file en mémoire pour la session en cours.
    }
  }

  private chargerDeviceId(): string {
    let id = localStorage.getItem(CLE_DEVICE);
    if (!id) {
      id = genererId();
      try { localStorage.setItem(CLE_DEVICE, id); } catch { /* stockage indisponible */ }
    }
    return id;
  }
}

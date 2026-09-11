import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';

import { OfflineQueueService, EnqueueInput } from './offline-queue.service';
import {
  SyncService,
  SyncMutationInput,
  SyncMutationResult,
  SyncPushResponse,
  SyncChangesResponse,
} from './sync.service';

/**
 * La file hors-ligne decide si une ecriture medicale est rejouee ou
 * abandonnee. Deux comportements y sont critiques et sont couverts en
 * priorite ci-dessous :
 *
 *   - une erreur *du serveur* ne doit jamais etre mise en file : la rejouer
 *     la ferait rejeter indefiniment ;
 *   - une mutation rejetee ne doit jamais disparaitre en silence : l'agent
 *     doit pouvoir corriger sa saisie.
 */

const CLE_FILE = 'bb-sync-queue';
const CLE_DERNIERE_SYNC = 'bb-last-sync';

/** Remplace navigator.onLine, qui est un accesseur en lecture seule. */
function simulerReseau(enLigne: boolean): void {
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    get: () => enLigne,
  });
}

class SyncServiceFactice {
  /** Mutations recues par le dernier appel a pushMutations. */
  dernierPush: SyncMutationInput[] = [];
  nbPush = 0;
  nbGetChanges = 0;

  /** Reponse que pushMutations renverra ; alimentee par chaque test. */
  reponsePush: SyncPushResponse = {
    success: true,
    data: [],
    meta: { accepted: 0, processed: 0, rejected: 0 },
  };

  erreurPush: unknown = null;

  pushMutations(mutations: SyncMutationInput[]): Observable<SyncPushResponse> {
    this.nbPush++;
    this.dernierPush = mutations;
    if (this.erreurPush) return throwError(() => this.erreurPush);
    return of(this.reponsePush);
  }

  getChanges(): Observable<SyncChangesResponse> {
    this.nbGetChanges++;
    return of({
      success: true,
      data: [],
      meta: { count: 0, lastVersion: null, serverTime: new Date().toISOString() },
    });
  }
}

function resultat(
  clientMutationId: string,
  statut: SyncMutationResult['statut'],
  erreur?: string
): SyncMutationResult {
  return { id: 'srv-' + clientMutationId, clientMutationId, entityType: 'consultation', statut, erreur };
}

const CONSULTATION: EnqueueInput = {
  entityType: 'consultation',
  operation: 'CREATE',
  payload: { motifPrincipal: 'Fievre' },
  libelle: 'Consultation — Aminata Camara',
};

describe('OfflineQueueService', () => {
  let sync: SyncServiceFactice;

  /**
   * Le service lit localStorage a l'instanciation : il faut donc preparer le
   * stockage avant de le demander a l'injecteur, pas dans un beforeEach global.
   */
  function creerService(): OfflineQueueService {
    return TestBed.inject(OfflineQueueService);
  }

  beforeEach(() => {
    localStorage.clear();
    simulerReseau(true);
    sync = new SyncServiceFactice();

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: SyncService, useValue: sync },
      ],
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  // ── executeOrQueue ────────────────────────────────────────────────
  describe('executeOrQueue', () => {
    it('met en file sans appeler le reseau quand le navigateur est hors ligne', async () => {
      simulerReseau(false);
      const service = creerService();
      let requeteAppelee = false;
      const requete$ = new Observable(() => {
        requeteAppelee = true;
      });

      const res = await new Promise<{ synchronise: boolean }>((resolve) =>
        service.executeOrQueue(requete$, CONSULTATION).subscribe(resolve)
      );

      expect(requeteAppelee).toBe(false);
      expect(res.synchronise).toBe(false);
      expect(service.nbEnAttente()).toBe(1);
    });

    it('ne met rien en file quand la requete aboutit', async () => {
      const service = creerService();

      const res = await new Promise<{ synchronise: boolean; data?: unknown }>((resolve) =>
        service.executeOrQueue(of({ id: 'c1' }), CONSULTATION).subscribe(resolve)
      );

      expect(res.synchronise).toBe(true);
      expect(res.data).toEqual({ id: 'c1' });
      expect(service.nbEnAttente()).toBe(0);
    });

    it('met en file quand la requete echoue faute de reseau (statut 0)', async () => {
      const service = creerService();
      const panne = new HttpErrorResponse({ status: 0, statusText: 'Unknown Error' });

      const res = await new Promise<{ synchronise: boolean }>((resolve) =>
        service.executeOrQueue(throwError(() => panne), CONSULTATION).subscribe(resolve)
      );

      expect(res.synchronise).toBe(false);
      expect(service.nbEnAttente()).toBe(1);
    });

    // Le cas le plus important : le serveur a repondu, il a donc rejete la
    // donnee en connaissance de cause. La rejouer la ferait rejeter a nouveau.
    it('laisse remonter une erreur du serveur sans rien mettre en file', async () => {
      const service = creerService();
      const refus = new HttpErrorResponse({ status: 400, statusText: 'Bad Request' });

      const erreurRecue = await new Promise<unknown>((resolve) =>
        service.executeOrQueue(throwError(() => refus), CONSULTATION).subscribe({
          next: () => resolve(null),
          error: resolve,
        })
      );

      expect(erreurRecue).toBe(refus);
      expect(service.nbEnAttente()).toBe(0);
    });
  });

  // ── enqueue / persistance ─────────────────────────────────────────
  describe('mise en file', () => {
    it('horodate, marque en attente et attribue un identifiant unique', () => {
      const service = creerService();

      const a = service.enqueue(CONSULTATION);
      const b = service.enqueue(CONSULTATION);

      expect(a.statut).toBe('pending');
      expect(a.libelle).toBe('Consultation — Aminata Camara');
      expect(a.queuedAt).toBeTruthy();
      expect(a.clientMutationId).not.toBe(b.clientMutationId);
    });

    it('persiste la file pour qu\'elle survive a la fermeture de l\'application', () => {
      const service = creerService();
      service.enqueue(CONSULTATION);

      const brut = localStorage.getItem(CLE_FILE);
      expect(brut).toBeTruthy();
      expect(JSON.parse(brut!)).toHaveLength(1);
    });

    it('repart d\'une file vide si le stockage est corrompu', () => {
      localStorage.setItem(CLE_FILE, '{ ceci n\'est pas du JSON');

      const service = creerService();

      expect(service.file()).toEqual([]);
    });

    it('retirer() supprime la mutation et met a jour le stockage', () => {
      const service = creerService();
      const m = service.enqueue(CONSULTATION);

      service.retirer(m.clientMutationId);

      expect(service.file()).toEqual([]);
      expect(JSON.parse(localStorage.getItem(CLE_FILE)!)).toEqual([]);
    });
  });

  // ── synchroniser ──────────────────────────────────────────────────
  describe('synchronisation', () => {
    it('retire de la file les mutations traitees par le serveur', async () => {
      const service = creerService();
      const m = service.enqueue(CONSULTATION);
      sync.reponsePush = {
        success: true,
        data: [resultat(m.clientMutationId, 'TRAITE')],
        meta: { accepted: 1, processed: 1, rejected: 0 },
      };

      await service.synchroniser();

      expect(service.file()).toEqual([]);
      expect(service.derniereSync()).toBeTruthy();
    });

    // Une saisie rejetee ne doit jamais disparaitre sans que l'agent le sache.
    it('conserve les mutations rejetees avec le motif du serveur', async () => {
      const service = creerService();
      const m = service.enqueue(CONSULTATION);
      sync.reponsePush = {
        success: true,
        data: [resultat(m.clientMutationId, 'REJETE', 'Patient introuvable')],
        meta: { accepted: 1, processed: 0, rejected: 1 },
      };

      await service.synchroniser();

      expect(service.nbEnAttente()).toBe(0);
      expect(service.rejetees()).toHaveLength(1);
      expect(service.rejetees()[0].erreur).toBe('Patient introuvable');
    });

    it('laisse intacte une mutation absente de la reponse du serveur', async () => {
      const service = creerService();
      service.enqueue(CONSULTATION);
      sync.reponsePush = {
        success: true,
        data: [resultat('un-identifiant-inconnu', 'TRAITE')],
        meta: { accepted: 0, processed: 0, rejected: 0 },
      };

      await service.synchroniser();

      expect(service.nbEnAttente()).toBe(1);
    });

    it('n\'appelle pas le serveur si la file est vide', async () => {
      const service = creerService();

      await service.synchroniser();

      expect(sync.nbPush).toBe(0);
      // Les changements distants sont recuperes meme sans rien a pousser.
      expect(sync.nbGetChanges).toBe(1);
    });

    it('ne tente rien hors ligne', async () => {
      const service = creerService();
      service.enqueue(CONSULTATION);
      simulerReseau(false);

      await service.synchroniser();

      expect(sync.nbPush).toBe(0);
      expect(service.nbEnAttente()).toBe(1);
    });

    it('expose le motif d\'echec sans vider la file', async () => {
      const service = creerService();
      service.enqueue(CONSULTATION);
      sync.erreurPush = { error: { error: 'Service indisponible' } };

      await service.synchroniser();

      expect(service.derniereErreur()).toBe('Service indisponible');
      expect(service.nbEnAttente()).toBe(1);
      expect(service.isSyncing()).toBe(false);
    });

    it('envoie au serveur la charge utile mise en file', async () => {
      const service = creerService();
      service.enqueue(CONSULTATION);

      await service.synchroniser();

      expect(sync.dernierPush).toHaveLength(1);
      expect(sync.dernierPush[0].entityType).toBe('consultation');
      expect(sync.dernierPush[0].operation).toBe('CREATE');
      expect(sync.dernierPush[0].payload).toEqual({ motifPrincipal: 'Fievre' });
      // Le libelle est purement local : il ne part pas au serveur.
      expect('libelle' in sync.dernierPush[0]).toBe(false);
    });
  });

  // ── reprise apres redemarrage ─────────────────────────────────────
  it('recharge une file persistee au demarrage suivant', () => {
    const premier = creerService();
    premier.enqueue(CONSULTATION);
    const stocke = localStorage.getItem(CLE_FILE);

    // Nouveau cycle de vie applicatif, meme stockage.
    TestBed.resetTestingModule();
    localStorage.setItem(CLE_FILE, stocke!);
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: SyncService, useValue: sync },
      ],
    });

    const second = TestBed.inject(OfflineQueueService);

    expect(second.nbEnAttente()).toBe(1);
    expect(second.file()[0].libelle).toBe('Consultation — Aminata Camara');
  });

  it('reprend la date de derniere synchronisation depuis le stockage', () => {
    localStorage.setItem(CLE_DERNIERE_SYNC, '2026-09-01T10:00:00.000Z');

    const service = creerService();

    expect(service.derniereSync()).toBe('2026-09-01T10:00:00.000Z');
  });
});

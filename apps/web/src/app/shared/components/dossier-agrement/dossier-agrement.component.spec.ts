// Ce que l'écran du dossier doit tenir.
//
// Il sert deux besoins que le blocage à la création ne couvre pas : compléter
// un dossier ancien **pièce par pièce**, et remplacer un agrément renouvelé.
// Trois comportements comptent vraiment :
//   - une pièce `AUTRE` sans libellé ne doit pas partir : le serveur la
//     refuse, et une pièce sans nom serait illisible dans la liste ;
//   - le refus local (taille, format) doit arrêter l'envoi, pas le laisser
//     monter pour rien ;
//   - une seule structure chargée à la fois, sinon une liste de quarante
//     établissements déclencherait quarante requêtes.
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import type { DossierAgrementView } from '@baobaoheath/shared-types';

import { DossierAgrementComponent } from './dossier-agrement.component';
import { AdminService } from '../../../core/services/admin.service';
import { I18nService } from '../../services/i18n.service';

const TOASTS = { success: 0, error: [] as string[] };

class ToastrStub {
  success() { TOASTS.success += 1; }
  error(message: string) { TOASTS.error.push(message); }
}

/**
 * L'i18n rend la clé : les assertions portent sur la clé, pas sur la langue.
 *
 * `lang` est un signal, pas une valeur : `TranslatePipe` le lit pour se
 * réexécuter quand la langue change. Sans lui, chaque gabarit du composant
 * échoue avant la première assertion.
 */
class I18nStub {
  readonly lang = signal<'fr' | 'en'>('fr');
  t(cle: string) { return cle; }
}

function vue(partiel: Partial<DossierAgrementView> = {}): DossierAgrementView {
  return {
    idStructure: 'cl-1',
    nom: 'Clinique Kipe',
    type: 'CLINIQUE',
    rccm: 'GN.TCC.2026.A.1',
    numeroAgrementCreation: 'ARR/1',
    numeroAgrementExploitation: 'ARR/2',
    lieuAutorise: 'Kipe',
    exigeDesPieces: true,
    complet: false,
    manquantes: ['AGREMENT_EXPLOITATION', 'DIPLOME_RESPONSABLE', 'INSCRIPTION_ORDRE'],
    pieces: [{
      id: 'p-1', type: 'AGREMENT_CREATION', taille: 204800, libelle: null,
      deposeLe: '2026-10-01T10:00:00.000Z',
    }],
    ...partiel,
  };
}

class AdminStub {
  dossier: DossierAgrementView = vue();
  lus: string[] = [];
  depots: { id: string; pieces: Record<string, File>; libelles: Record<string, string> }[] = [];
  echoueLeDepot = false;

  dossierStructure(id: string) {
    this.lus.push(id);
    return of({ success: true, data: this.dossier });
  }

  deposerPieces(id: string, pieces: Record<string, File>, libelles: Record<string, string> = {}) {
    this.depots.push({ id, pieces, libelles });
    if (this.echoueLeDepot) return throwError(() => ({ error: { error: 'refus du serveur' } }));
    return of({ success: true, data: this.dossier });
  }

  piece() { return of(new Blob(['%PDF-'], { type: 'application/pdf' })); }
}

function evenement(fichier: File | null) {
  return { target: { files: fichier ? [fichier] : [], value: 'x' } } as unknown as Event;
}

function pdf(nom = 'piece.pdf', octets = 2048): File {
  return new File([new Uint8Array(octets)], nom, { type: 'application/pdf' });
}

function monter(stub: AdminStub, id = 'cl-1') {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [DossierAgrementComponent],
    providers: [
      provideZonelessChangeDetection(),
      { provide: AdminService, useValue: stub },
      { provide: ToastrService, useClass: ToastrStub },
      { provide: I18nService, useClass: I18nStub },
    ],
  });
  const fixture = TestBed.createComponent(DossierAgrementComponent);
  fixture.componentRef.setInput('idStructure', id);
  fixture.detectChanges();
  return fixture;
}

beforeEach(() => {
  TOASTS.success = 0;
  TOASTS.error = [];
});

describe('le chargement du dossier', () => {
  it('charge la structure demandee', () => {
    const stub = new AdminStub();
    const f = monter(stub);

    expect(stub.lus).toEqual(['cl-1']);
    expect(f.componentInstance.dossier()?.nom).toBe('Clinique Kipe');
  });

  // **Une seule structure a la fois.** La liste d'administration monte ce
  // composant pour la ligne depliee : charger les quarante autres ferait
  // quarante requetes pour rien.
  it('recharge quand la structure change, et une seule fois par structure', () => {
    const stub = new AdminStub();
    const f = monter(stub);

    f.componentRef.setInput('idStructure', 'cl-2');
    f.detectChanges();

    expect(stub.lus).toEqual(['cl-1', 'cl-2']);
  });

  it('montre les types exiges absents et ceux deja deposes', () => {
    const stub = new AdminStub();
    const f = monter(stub);

    expect([...f.componentInstance.lignes()].sort()).toEqual([
      'AGREMENT_CREATION', 'AGREMENT_EXPLOITATION', 'DIPLOME_RESPONSABLE', 'INSCRIPTION_ORDRE',
    ]);
    expect(f.componentInstance.estManquante('AGREMENT_CREATION')).toBe(false);
    expect(f.componentInstance.estManquante('DIPLOME_RESPONSABLE')).toBe(true);
  });

  // Une structure publique est complete sans rien deposer : l'ecran ne doit
  // pas lui inventer de lignes.
  it('ne demande rien a une structure publique', () => {
    const stub = new AdminStub();
    stub.dossier = vue({ type: 'CHU', exigeDesPieces: false, complet: true, manquantes: [], pieces: [] });
    const f = monter(stub);

    expect(f.componentInstance.lignes()).toEqual([]);
  });

  // La liste arrive du plus recent au plus ancien : c'est la premiere qui
  // compte, sinon un agrement remplace reapparaitrait a la place du nouveau.
  it('retient la piece la plus recente de chaque type', () => {
    const stub = new AdminStub();
    stub.dossier = vue({
      pieces: [
        { id: 'neuve', type: 'AGREMENT_CREATION', taille: 2048, libelle: null, deposeLe: '2026-10-20T00:00:00.000Z' },
        { id: 'vieille', type: 'AGREMENT_CREATION', taille: 1024, libelle: null, deposeLe: '2026-01-01T00:00:00.000Z' },
      ],
    });
    const f = monter(stub);

    expect(f.componentInstance.pieceDe('AGREMENT_CREATION')?.id).toBe('neuve');
  });
});

describe('le depot d une piece', () => {
  it('envoie le fichier choisi pour ce type', () => {
    const stub = new AdminStub();
    const f = monter(stub);
    const fichier = pdf('diplome.pdf');

    f.componentInstance.deposer('DIPLOME_RESPONSABLE', evenement(fichier));

    expect(stub.depots).toHaveLength(1);
    expect(stub.depots[0]?.pieces['DIPLOME_RESPONSABLE']).toBe(fichier);
    expect(stub.depots[0]?.id).toBe('cl-1');
    expect(TOASTS.success).toBe(1);
  });

  // **Un agrement se renouvelle** : remplacer est le meme geste que deposer,
  // le serveur substitue l'ancienne piece dans la meme transaction.
  it('remplace une piece deja presente par le meme chemin', () => {
    const stub = new AdminStub();
    const f = monter(stub);

    f.componentInstance.deposer('AGREMENT_CREATION', evenement(pdf('renouvele.pdf')));

    expect(stub.depots[0]?.pieces['AGREMENT_CREATION']).toBeDefined();
  });

  it('n envoie rien quand aucun fichier n est choisi', () => {
    const stub = new AdminStub();
    const f = monter(stub);

    f.componentInstance.deposer('DIPLOME_RESPONSABLE', evenement(null));

    expect(stub.depots).toHaveLength(0);
  });

  // Le refus local existe pour ne pas faire monter 20 Mo avant d'etre rejete.
  it('refuse un fichier trop gros sans l envoyer', () => {
    const stub = new AdminStub();
    const f = monter(stub);

    f.componentInstance.deposer('DIPLOME_RESPONSABLE', evenement(pdf('gros.pdf', 6 * 1024 * 1024)));

    expect(stub.depots).toHaveLength(0);
    expect(TOASTS.error).toEqual(['AGREMENT.PIECE.TROP_GROS']);
  });

  it('refuse un fichier qui n est pas un PDF sans l envoyer', () => {
    const stub = new AdminStub();
    const f = monter(stub);
    const image = new File([new Uint8Array(1024)], 'scan.png', { type: 'image/png' });

    f.componentInstance.deposer('DIPLOME_RESPONSABLE', evenement(image));

    expect(stub.depots).toHaveLength(0);
    expect(TOASTS.error).toEqual(['AGREMENT.PIECE.PAS_UN_PDF']);
  });

  it('refuse un fichier vide', () => {
    const stub = new AdminStub();
    const f = monter(stub);

    f.componentInstance.deposer('DIPLOME_RESPONSABLE', evenement(pdf('vide.pdf', 0)));

    expect(stub.depots).toHaveLength(0);
    expect(TOASTS.error).toEqual(['AGREMENT.PIECE.VIDE']);
  });

  it('relache le verrou d envoi apres un echec serveur', () => {
    const stub = new AdminStub();
    stub.echoueLeDepot = true;
    const f = monter(stub);

    f.componentInstance.deposer('DIPLOME_RESPONSABLE', evenement(pdf()));

    expect(f.componentInstance.envoi()).toBeNull();
    expect(TOASTS.error).toEqual(['refus du serveur']);
  });
});

// **Le cas qui compte.**
describe('les pieces complementaires', () => {
  it('refuse une piece AUTRE sans libelle, et ne l envoie pas', () => {
    const stub = new AdminStub();
    const f = monter(stub);

    f.componentInstance.deposer('AUTRE', evenement(pdf('plan.pdf')));

    expect(stub.depots).toHaveLength(0);
    expect(TOASTS.error).toEqual(['AGREMENT.DOSSIER.LIBELLE_REQUIS']);
  });

  it('refuse un libelle fait d espaces', () => {
    const stub = new AdminStub();
    const f = monter(stub);
    f.componentInstance.libelleAutre.set('   ');

    f.componentInstance.deposer('AUTRE', evenement(pdf('plan.pdf')));

    expect(stub.depots).toHaveLength(0);
  });

  it('envoie le libelle avec le fichier', () => {
    const stub = new AdminStub();
    const f = monter(stub);
    f.componentInstance.libelleAutre.set('  Plan architectural  ');

    f.componentInstance.deposer('AUTRE', evenement(pdf('plan.pdf')));

    expect(stub.depots[0]?.libelles).toEqual({ AUTRE: 'Plan architectural' });
  });

  it('vide le libelle apres un depot reussi', () => {
    const stub = new AdminStub();
    const f = monter(stub);
    f.componentInstance.libelleAutre.set('Plan architectural');

    f.componentInstance.deposer('AUTRE', evenement(pdf('plan.pdf')));

    expect(f.componentInstance.libelleAutre()).toBe('');
  });

  it('liste les pieces complementaires a part des types nommes', () => {
    const stub = new AdminStub();
    stub.dossier = vue({
      pieces: [
        { id: 'a1', type: 'AUTRE', taille: 1024, libelle: 'Plan', deposeLe: '2026-10-01T00:00:00.000Z' },
        { id: 'a2', type: 'AUTRE', taille: 2048, libelle: 'Equipements', deposeLe: '2026-10-02T00:00:00.000Z' },
      ],
    });
    const f = monter(stub);

    expect(f.componentInstance.autres().map((p) => p.libelle)).toEqual(['Plan', 'Equipements']);
    // `AUTRE` n'est pas un type nomme : il ne doit pas apparaitre en ligne.
    expect(f.componentInstance.lignes()).not.toContain('AUTRE');
  });
});

describe('la taille affichee', () => {
  it('se lit en Ko ou en Mo', () => {
    const stub = new AdminStub();
    const f = monter(stub);

    expect(f.componentInstance.taille(204800)).toBe('200 Ko');
    expect(f.componentInstance.taille(2 * 1024 * 1024)).toBe('2.0 Mo');
  });
});

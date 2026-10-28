// Ce que le choix de laboratoire doit tenir.
//
// Trois comportements, et un seul vraiment dangereux : **un laboratoire choisi
// puis disparu de la liste ne doit pas rester selectionne.** Le medecin coche
// un examen de plus, le laboratoire ne le realise pas et sort du groupe — si
// `idChoisi` restait, la demande partirait vers une structure que l'ecran ne
// montre plus. On remonte `null` au parent, qui desactive l'envoi.
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { of } from 'rxjs';
import type { ChoixLaboratoiresView, LaboratoireChoixView } from '@baobaoheath/shared-types';

import { ChoixLaboratoireComponent, ChoixLaboratoire } from './choix-laboratoire.component';
import { HopitalService } from '../../../core/services/hopital.service';

function labo(partiel: Partial<LaboratoireChoixView>): LaboratoireChoixView {
  return {
    id: 'l1', nom: 'Laboratoire', type: 'LABORATOIRE', prefecture: 'Conakry',
    origine: 'AUTRE', couverts: 0, demandes: 0, nonCouverts: [], plateauNonDeclare: false,
    ...partiel,
  };
}

function vue(partiel: Partial<ChoixLaboratoiresView>): ChoixLaboratoiresView {
  return { interne: [], conseilles: [], autres: [], prefecture: 'Conakry', toutLePays: false, ...partiel };
}

/** Le service est remplace : ce fichier teste l'ecran, pas le reseau. */
class HopitalStub {
  reponse: ChoixLaboratoiresView = vue({});
  appels: { ids: string[]; toutLePays: boolean }[] = [];

  choixLaboratoires(idsExamens: string[], toutLePays = false) {
    this.appels.push({ ids: [...idsExamens], toutLePays });
    return of({ success: true, data: this.reponse });
  }
}

function monter(stub: HopitalStub, examens: string[] = []) {
  TestBed.configureTestingModule({
    imports: [ChoixLaboratoireComponent],
    providers: [
      provideZonelessChangeDetection(),
      { provide: HopitalService, useValue: stub },
    ],
  });
  const fixture = TestBed.createComponent(ChoixLaboratoireComponent);
  fixture.componentRef.setInput('examens', examens);
  fixture.detectChanges();
  return fixture;
}

describe('le choix du laboratoire', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('range les groupes dans l ordre du parcours et ecarte les vides', () => {
    const stub = new HopitalStub();
    stub.reponse = vue({
      interne: [labo({ id: 'interne', origine: 'INTERNE' })],
      autres: [labo({ id: 'autre' })],
    });
    const f = monter(stub);

    // « Chez nous » en tete ; le groupe des conseilles, vide, ne s'affiche pas.
    expect(f.componentInstance.groupes().map((g) => g.cle)).toEqual(['INTERNE', 'AUTRE']);
  });

  it('recharge la couverture a chaque examen coche', () => {
    const stub = new HopitalStub();
    const f = monter(stub, ['e1']);
    f.componentInstance.examens;

    f.componentRef.setInput('examens', ['e1', 'e2']);
    f.detectChanges();

    expect(stub.appels.map((a) => a.ids)).toEqual([['e1'], ['e1', 'e2']]);
  });

  it('elargit a tout le pays sans rien verrouiller', () => {
    const stub = new HopitalStub();
    const f = monter(stub, ['e1']);

    f.componentInstance.basculerPays();
    f.detectChanges();

    expect(stub.appels.map((a) => a.toutLePays)).toEqual([false, true]);
  });

  it('remonte au parent le laboratoire choisi et ce qu il ne fait pas', () => {
    const stub = new HopitalStub();
    const manquant = { id: 'x1', libelle: 'TPHA', codeLoinc: '22592-9' };
    stub.reponse = vue({
      autres: [labo({ id: 'partiel', nom: 'Laboratoire Cece', couverts: 1, demandes: 2, nonCouverts: [manquant] })],
    });
    const f = monter(stub, ['e1', 'e2']);

    const recus: (ChoixLaboratoire | null)[] = [];
    f.componentInstance.choisi.subscribe((c) => recus.push(c));
    f.componentInstance.choisir('partiel');

    expect(recus).toEqual([{ id: 'partiel', nom: 'Laboratoire Cece', nonCouverts: [manquant] }]);
  });

  // **Le cas qui compte.** Sans cette remise a zero, l'envoi partirait vers un
  // laboratoire que l'ecran ne propose plus.
  it('deselectionne un laboratoire sorti de la liste apres rechargement', () => {
    const stub = new HopitalStub();
    stub.reponse = vue({ autres: [labo({ id: 'cece' })] });
    const f = monter(stub, ['e1']);

    const recus: (ChoixLaboratoire | null)[] = [];
    f.componentInstance.choisi.subscribe((c) => recus.push(c));
    f.componentInstance.choisir('cece');
    expect(f.componentInstance.idChoisi()).toBe('cece');

    // Un examen de plus : ce laboratoire ne le realise pas, il quitte la liste.
    stub.reponse = vue({ autres: [labo({ id: 'donka' })] });
    f.componentRef.setInput('examens', ['e1', 'e2']);
    f.detectChanges();

    expect(f.componentInstance.idChoisi()).toBeNull();
    expect(recus[recus.length - 1]).toBeNull();
  });

  it('garde le laboratoire choisi quand il est toujours propose', () => {
    const stub = new HopitalStub();
    stub.reponse = vue({ autres: [labo({ id: 'cece' })] });
    const f = monter(stub, ['e1']);
    f.componentInstance.choisir('cece');

    stub.reponse = vue({ autres: [labo({ id: 'cece', couverts: 1, demandes: 2 })] });
    f.componentRef.setInput('examens', ['e1', 'e2']);
    f.detectChanges();

    expect(f.componentInstance.idChoisi()).toBe('cece');
  });

  // Tant qu'aucun examen n'est coche, « 0 sur 0 » n'apprendrait rien.
  it('n affiche pas de compte avant qu un examen soit coche', () => {
    const stub = new HopitalStub();
    const f = monter(stub);
    const sansDemande = labo({ couverts: 0, demandes: 0 });

    expect(f.componentInstance.couverture(sansDemande)).toBe('');
    expect(f.componentInstance.complet(sansDemande)).toBe(true);
  });

  it('distingue la couverture complete de la partielle', () => {
    const stub = new HopitalStub();
    const f = monter(stub);

    expect(f.componentInstance.complet(labo({ couverts: 5, demandes: 5 }))).toBe(true);
    expect(f.componentInstance.complet(labo({ couverts: 3, demandes: 5 }))).toBe(false);
    expect(f.componentInstance.couverture(labo({ couverts: 3, demandes: 5 }))).toBe('3/5');
  });

  it('nomme les examens manquants, il ne les compte pas', () => {
    const stub = new HopitalStub();
    const f = monter(stub);
    const partiel = labo({
      nonCouverts: [
        { id: 'a', libelle: 'TPHA', codeLoinc: '1' },
        { id: 'b', libelle: 'VDRL', codeLoinc: '2' },
      ],
    });

    expect(f.componentInstance.manquants(partiel)).toBe('TPHA, VDRL');
  });
});

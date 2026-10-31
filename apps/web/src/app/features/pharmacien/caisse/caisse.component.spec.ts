// La caisse n'encaisse rien tant qu'aucune session n'est ouverte.
//
// Le verrou existait deja (fieldset desactive, `peutEncaisser` qui exige la
// session) mais rien ne le gardait, et l'ecran ne disait pas pourquoi le
// panier ne repondait pas : on croyait l'ecran bloque.
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { of } from 'rxjs';
import { ToastrService } from 'ngx-toastr';

import { CaisseComponent } from './caisse.component';
import { PharmacienService } from '../../../core/services/pharmacien.service';

function monter(statut: 'OUVERTE' | 'CLOTUREE' | null) {
  const session = statut
    ? {
        id: 's1', statut, montantOuvertureGnf: 0, montantEspecesEncaisseGnf: 0, montantOrangeMoneyGnf: 0,
        montantMtnMomoGnf: 0, montantTheoriqueGnf: 0, montantCompteGnf: null, ecartGnf: null, motifEcart: null,
        nombreVentesPayees: 0, nombreVentesEnAttente: 0, nombreVentesAnnulees: 0,
        ouverteLe: new Date().toISOString(), clotureeLe: null,
        utilisateur: { prenom: 'Mariama', nom: 'Bah' },
      }
    : null;
  const pharma = {
    getStocks: () => of({ success: true, data: [] }),
    getVentes: () => of({ success: true, data: [] }),
    getSessionCaisse: () => of({ success: true, data: session }),
  };
  TestBed.configureTestingModule({
    imports: [CaisseComponent],
    providers: [
      provideZonelessChangeDetection(),
      { provide: PharmacienService, useValue: pharma },
      { provide: ToastrService, useValue: { success() {}, error() {}, warning() {}, info() {} } },
    ],
  });
  const fixture = TestBed.createComponent(CaisseComponent);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

const panier = (el: HTMLElement) => el.querySelector<HTMLFieldSetElement>('fieldset.bb-caisse__fieldset')!;
const avis = (el: HTMLElement) => el.querySelector('.bb-caisse__panier-ferme');

describe('caisse : panier et session', () => {
  beforeEach(() => TestBed.resetTestingModule());

  for (const statut of [null, 'CLOTUREE'] as const) {
    it(`verrouille le panier et dit pourquoi (session ${statut ?? 'absente'})`, () => {
      const el = monter(statut);
      expect(panier(el).disabled).toBe(true);
      expect(avis(el)?.textContent?.trim().length ?? 0).toBeGreaterThan(10);
    });
  }

  it('ouvre le panier quand la caisse est ouverte, sans avis', () => {
    const el = monter('OUVERTE');
    expect(panier(el).disabled).toBe(false);
    expect(avis(el)).toBeNull();
  });
});

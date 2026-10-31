// Le tableau de bord médecin ne doit signaler que ce qui existe.
//
// Le badge « À traiter » et la teinte d'avertissement de la première carte
// s'affichaient avec un compteur à 0 : une alerte sans rien à signaler, que
// l'œil apprend vite à ignorer — y compris le jour où elle compte.
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { of } from 'rxjs';

import { MedecinDashboardComponent } from './dashboard.component';
import { MedecinService } from '../../../core/services/medecin.service';
import { AuthService } from '../../../core/services/auth.service';

function monter(enAttente: number) {
  const medecin = {
    getDashboard: () => of({
      success: true,
      data: { consultationsEnAttente: enAttente, consultationsValidees: 2, referencementsEnAttente: 0, messagesNonLus: 0, structure: null },
    }),
    getConsultationsRecentes: () => of({ success: true, data: [] }),
  };
  TestBed.configureTestingModule({
    imports: [MedecinDashboardComponent],
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([]),
      { provide: MedecinService, useValue: medecin },
      { provide: AuthService, useValue: { currentUser: signal({ prenom: 'Awa', nom: 'Camara' }) } },
    ],
  });
  const fixture = TestBed.createComponent(MedecinDashboardComponent);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('tableau de bord médecin', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it("n'affiche ni badge ni avertissement quand rien n'attend", () => {
    const el = monter(0);
    expect(el.querySelector('.bb-med-dash__stat-pill')).toBeNull();
    expect(el.querySelector('.bb-med-dash__stat-card--warning')).toBeNull();
  });

  it('signale les consultations en attente quand il y en a', () => {
    const el = monter(3);
    expect(el.querySelector('.bb-med-dash__stat-pill')).not.toBeNull();
    expect(el.querySelector('.bb-med-dash__stat-card--warning')).not.toBeNull();
  });

  it("n'a pas d'emoji dans l'en-tête", () => {
    const el = monter(0);
    expect(el.querySelector('h1')?.textContent ?? '').not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it('les liens « Voir tout » ne sont pas en majuscules', () => {
    const scss = readFileSync(join(process.cwd(), 'src', 'app', 'features', 'medecin', 'dashboard', 'dashboard.component.scss'), 'utf8');
    for (const bloc of ['&__see-all {', '&__stat-link {']) {
      const debut = scss.indexOf(bloc);
      expect(debut).toBeGreaterThan(-1);
      const corps = scss.slice(debut, scss.indexOf('\n  }', debut));
      expect(corps).not.toMatch(/uppercase/);
    }
  });
});

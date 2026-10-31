// Le menu de l'admin de structure ne depend pas des statistiques.
//
// Quand `/admin-structure/stats` echouait, les entrees Pharmacies et
// Assurances d'un hopital disparaissaient : le menu tenait au calcul le plus
// lourd de l'ecran. Il lit desormais `/admin-structure/ma-structure`.
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { AdminStructureLayoutComponent } from './admin-structure-layout.component';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';

function monter(reponses: Record<string, () => unknown>) {
  const api = {
    get: (url: string) => (reponses[url] ?? (() => throwError(() => ({ status: 500 }))))(),
  };
  TestBed.configureTestingModule({
    imports: [AdminStructureLayoutComponent],
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([]),
      { provide: ApiService, useValue: api },
      { provide: AuthService, useValue: { currentUser: signal(null), doitChangerMotDePasse: signal(false), logout() {} } },
    ],
  });
  // On teste le menu, pas la coquille : le gabarit et ses enfants sont ecartes.
  TestBed.overrideComponent(AdminStructureLayoutComponent, { set: { template: '', imports: [] } });
  return TestBed.createComponent(AdminStructureLayoutComponent).componentInstance;
}

const routes = (c: AdminStructureLayoutComponent) => c.navItems.map((i) => i.route);

describe('menu de l\'admin de structure', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('garde Pharmacies et Assurances d\'un hôpital même si les statistiques échouent', () => {
    const c = monter({
      '/admin-structure/ma-structure': () => of({ success: true, data: { id: 's1', nom: 'CHU', type: 'CHU', hospitaliere: true } }),
      '/admin-structure/stats': () => throwError(() => ({ status: 500 })),
    });
    expect(routes(c)).toContain('/admin-structure/pharmacies');
    expect(routes(c)).toContain('/admin-structure/assurances');
    expect(c.pharmaciesNavError()).toBe(false);
  });

  it('ne les montre pas à une structure non hospitalière', () => {
    const c = monter({
      '/admin-structure/ma-structure': () => of({ success: true, data: { id: 's2', nom: 'P', type: 'PHARMACIE', hospitaliere: false } }),
    });
    expect(routes(c)).not.toContain('/admin-structure/pharmacies');
  });

  it('signale l\'échec seulement si la structure elle-même est illisible', () => {
    const c = monter({});
    expect(c.pharmaciesNavError()).toBe(true);
    expect(routes(c)).toContain('/admin-structure/agents');
  });
});

// features/laboratoire/laboratoire.routes.ts — espace Laboratoire (P2, EF-04)
import { Routes } from '@angular/router';

export const LABORATOIRE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('../../shared/components/labo-layout/labo-layout.component').then(m => m.LaboLayoutComponent),
    children: [
      { path: '', redirectTo: 'tableau-de-bord', pathMatch: 'full' },
      { path: 'tableau-de-bord', loadComponent: () => import('./tableau-de-bord/tableau-de-bord.component').then(m => m.LaboTableauDeBordComponent) },
      { path: 'demandes', loadComponent: () => import('./demandes/demandes.component').then(m => m.LaboDemandesComponent) },
      { path: 'demandes/:id', loadComponent: () => import('./demande-detail/demande-detail.component').then(m => m.LaboDemandeDetailComponent) },
    ]
  }
];

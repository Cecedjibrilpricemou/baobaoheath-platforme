// features/medecin/medecin.routes.ts
import { Routes } from '@angular/router';

export const MEDECIN_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('../../shared/components/medecin-layout/medecin-layout.component')
        .then(m => m.MedecinLayoutComponent),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./dashboard/dashboard.component').then(m => m.MedecinDashboardComponent)
      },
      {
        path: 'consultations',
        loadComponent: () =>
          import('./consultations/consultations.component').then(m => m.MedecinConsultationsComponent)
      },
      {
        path: 'messagerie',
        loadComponent: () =>
          import('./messagerie/messagerie.component').then(m => m.MessagerieComponent)
      }
    ]
  }
];

// features/patient/patient.routes.ts
// CORRIGÉ : ajout du PatientLayoutComponent comme parent (comme ASC)

import { Routes } from '@angular/router';

export const PATIENT_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('../../shared/components/patient-layout/patient-layout.component')
        .then(m => m.PatientLayoutComponent),
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'profil',
        loadComponent: () =>
          import('./profil/profil.component').then(m => m.ProfilComponent)
      },
      {
        path: 'qr-code',
        loadComponent: () =>
          import('./qr-code/qr-code.component').then(m => m.QrCodeComponent)
      }
    ]
  }
];

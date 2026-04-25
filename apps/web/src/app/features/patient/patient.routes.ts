// features/patient/patient.routes.ts
// Routes du module Patient — dashboard, profil, QR code

import { Routes } from '@angular/router';

export const PATIENT_ROUTES: Routes = [
  {
    // Route par défaut → dashboard
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
];
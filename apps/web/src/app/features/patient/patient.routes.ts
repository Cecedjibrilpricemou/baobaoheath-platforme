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
      },
      {
        path: 'carnet-vaccinal',
        loadComponent: () =>
          import('./dossier/dossier').then(m => m.Dossier)
      },
      {
        path: 'parcours',
        loadComponent: () =>
          import('./parcours/parcours.component').then(m => m.ParcoursComponent)
      },
      {
        path: 'resultats',
        loadComponent: () =>
          import('./resultats/resultats.component').then(m => m.ResultatsComponent)
      },
      {
        path: 'consentements',
        loadComponent: () =>
          import('./consentements/consentements.component').then(m => m.ConsentementsComponent)
      }
    ]
  }
];

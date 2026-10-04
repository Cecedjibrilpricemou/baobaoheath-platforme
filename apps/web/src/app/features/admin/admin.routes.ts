import { Routes } from '@angular/router';

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('../../shared/components/admin-layout/admin-layout.component')
        .then(m => m.AdminLayoutComponent),
    children: [
      { path: '', redirectTo: 'analytics', pathMatch: 'full' },
      {
        path: 'analytics',
        loadComponent: () =>
          import('./analytics/analytics.component').then(m => m.AnalyticsComponent)
      },
      {
        path: 'structures',
        loadComponent: () =>
          import('./structures/structures.component').then(m => m.StructuresComponent)
      },
      {
        path: 'export',
        loadComponent: () =>
          import('./export/export.component').then(m => m.ExportComponent)
      },
      {
        path: 'demandes-rgpd',
        loadComponent: () =>
          import('./demandes-rgpd/demandes-rgpd.component').then(m => m.DemandesRgpdComponent)
      },
      {
        path: 'comptes',
        loadComponent: () =>
          import('./comptes/comptes.component').then(m => m.ComptesComponent)
      },
      {
        path: 'journal',
        loadComponent: () =>
          import('./journal/journal.component').then(m => m.JournalComponent)
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./settings/settings.component').then(m => m.SettingsComponent)
      }
    ]
  }
];

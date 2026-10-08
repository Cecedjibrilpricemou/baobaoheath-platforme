import { Routes } from '@angular/router';
import { roleGuard } from '../../core/guards/role.guard';

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
        // L'espace /admin accueille aussi l'admin regional et l'admin de
        // structure ; l'API d'assurance ne repond qu'a l'administration
        // nationale. Cacher l'entree de menu ne suffit pas : l'URL se tape.
        path: 'assurance',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN_NATIONAL', 'SUPER_ADMIN'] },
        loadComponent: () =>
          import('./assurance/assurance.component').then(m => m.AssuranceComponent)
      },
      {
        path: 'journal',
        loadComponent: () =>
          import('./journal/journal.component').then(m => m.JournalComponent)
      },
      {
        path: 'bris-de-glace',
        loadComponent: () =>
          import('./bris-de-glace/bris-de-glace-revue.component').then(m => m.BrisDeGlaceRevueComponent)
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./settings/settings.component').then(m => m.SettingsComponent)
      }
    ]
  }
];

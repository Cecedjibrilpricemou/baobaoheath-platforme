import { Routes } from '@angular/router';

export const ADMIN_STRUCTURE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('../../shared/components/admin-structure-layout/admin-structure-layout.component')
        .then(m => m.AdminStructureLayoutComponent),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./dashboard/dashboard.component').then(m => m.AdminStructureDashboardComponent)
      },
      {
        path: 'agents',
        loadComponent: () =>
          import('./agents/agents.component').then(m => m.AgentsComponent)
      }
    ]
  }
];

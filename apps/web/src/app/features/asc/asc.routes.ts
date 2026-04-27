// features/asc/asc.routes.ts
// Routes du module ASC — consultations, stocks, planning

import { Routes } from '@angular/router';

export const ASC_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('../../shared/components/asc-layout/asc-layout.component')
        .then(m => m.AscLayoutComponent),
    children: [
      {
        path: '',
        redirectTo: 'consultations',
        pathMatch: 'full'
      },
      {
        path: 'consultations',
        loadComponent: () =>
          import('./consultations/consultations.component')
            .then(m => m.ConsultationsComponent)
      },
      {
        path: 'stocks',
        loadComponent: () =>
          import('./stocks/stocks.component')
            .then(m => m.StocksComponent)
      },
      {
        path: 'planning',
        loadComponent: () =>
          import('./planning/planning.component')
            .then(m => m.PlanningComponent)
      }
    ]
  }
];
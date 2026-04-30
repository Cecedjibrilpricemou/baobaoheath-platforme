// features/pharmacien/pharmacien.routes.ts
import { Routes } from '@angular/router';

export const PHARMACIEN_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('../../shared/components/pharmacien-layout/pharmacien-layout.component')
        .then(m => m.PharmacienLayoutComponent),
    children: [
      { path: '', redirectTo: 'scanner', pathMatch: 'full' },
      {
        path: 'scanner',
        loadComponent: () =>
          import('./scanner/scanner.component').then(m => m.ScannerComponent)
      },
      {
        path: 'ordonnances',
        loadComponent: () =>
          import('./ordonnances/ordonnances.component').then(m => m.OrdonnancesComponent)
      },
      {
        path: 'stocks',
        loadComponent: () =>
          import('./stocks/stocks.component').then(m => m.PharmacienStocksComponent)
      }
    ]
  }
];

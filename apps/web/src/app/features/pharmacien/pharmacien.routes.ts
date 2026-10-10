// features/pharmacien/pharmacien.routes.ts
import { Routes } from '@angular/router';

export const PHARMACIEN_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('../../shared/components/pharmacien-layout/pharmacien-layout.component')
        .then(m => m.PharmacienLayoutComponent),
    children: [
      { path: '', redirectTo: 'ordonnances', pathMatch: 'full' },
      {
        path: 'commandes',
        loadComponent: () =>
          import('./commandes/commandes.component').then(m => m.PharmacienCommandesComponent)
      },
      {
        path: 'ordonnances',
        loadComponent: () =>
          import('./ordonnances/ordonnances.component').then(m => m.OrdonnancesComponent)
      },
      {
        path: 'approvisionnements',
        loadComponent: () =>
          import('./approvisionnements/approvisionnements.component').then(m => m.ApprovisionnementsComponent)
      },
      {
        path: 'peremptions',
        loadComponent: () =>
          import('./peremptions/peremptions.component').then(m => m.PeremptionsComponent)
      },
      {
        path: 'caisse',
        loadComponent: () =>
          import('./caisse/caisse.component').then(m => m.CaisseComponent)
      },
      {
        path: 'tableau-de-bord',
        loadComponent: () =>
          import('./tableau-de-bord/tableau-de-bord.component').then(m => m.TableauDeBordComponent)
      },
      {
        path: 'stocks',
        loadComponent: () =>
          import('./stocks/stocks.component').then(m => m.PharmacienStocksComponent)
      }
    ]
  }
];

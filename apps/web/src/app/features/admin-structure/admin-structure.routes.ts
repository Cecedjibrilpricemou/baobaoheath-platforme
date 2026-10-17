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
      },
      // L'ecran des identites, partage avec l'accueil (EF-01-04/05/06).
      //
      // **C'est ici que vit la fusion de dossiers**, reservee a ce role : un
      // agent d'accueil verifie des pieces, melanger deux dossiers medicaux
      // n'est pas son geste. L'ecran etait routable depuis `/hopital`
      // seulement, donc inatteignable par le seul role qui a le droit de
      // fusionner — la fonction aurait ete livree inutilisable.
      {
        path: 'identites',
        loadComponent: () =>
          import('../hopital/identites/identites.component').then(m => m.IdentitesComponent)
      }
    ]
  }
];

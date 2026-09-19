// features/hopital/hopital.routes.ts — espace Accueil hopital (P1, EF-03)
import { Routes } from '@angular/router';

export const HOPITAL_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('../../shared/components/hopital-layout/hopital-layout.component').then(m => m.HopitalLayoutComponent),
    children: [
      { path: '', redirectTo: 'tableau-de-bord', pathMatch: 'full' },
      { path: 'tableau-de-bord', loadComponent: () => import('./tableau-de-bord/tableau-de-bord.component').then(m => m.TableauDeBordComponent) },
      { path: 'admission', loadComponent: () => import('./admission/admission.component').then(m => m.AdmissionComponent) },
      { path: 'episodes', loadComponent: () => import('./episodes/episodes.component').then(m => m.EpisodesComponent) },
      { path: 'episodes/:id', loadComponent: () => import('./episode-detail/episode-detail.component').then(m => m.EpisodeDetailComponent) },
      { path: 'alertes', loadComponent: () => import('./alertes/alertes.component').then(m => m.AlertesComponent) },
    ]
  }
];

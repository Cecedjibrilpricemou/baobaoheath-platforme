// features/medecin/medecin.routes.ts
import { Routes } from '@angular/router';

export const MEDECIN_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('../../shared/components/medecin-layout/medecin-layout.component')
        .then(m => m.MedecinLayoutComponent),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./dashboard/dashboard.component').then(m => m.MedecinDashboardComponent)
      },
      {
        path: 'consultations',
        loadComponent: () =>
          import('./consultations/consultations.component').then(m => m.MedecinConsultationsComponent)
      },
      // **Le meme ecran que l'ASC, pas une copie.** Ses constantes, son
      // diagnostic et son ordonnance ne dependent d'aucun service propre a
      // l'ASC, et l'API ouvre ces trois endpoints au medecin. Le composant
      // s'adapte au role appelant plutot que d'exister en double.
      {
        path: 'consultations/:id',
        loadComponent: () =>
          import('../asc/consultation-detail/consultation-detail.component')
            .then(m => m.ConsultationDetailComponent)
      },
      {
        path: 'dossier/:id',
        loadComponent: () =>
          import('./dossier/dossier.component').then(m => m.DossierComponent)
      },
      {
        path: 'resultats',
        loadComponent: () =>
          import('./resultats/resultats.component').then(m => m.ResultatsComponent)
      },
      {
        path: 'demandes',
        loadComponent: () =>
          import('./demandes/demandes.component').then(m => m.DemandesComponent)
      },
      {
        path: 'agenda',
        loadComponent: () =>
          import('./agenda/agenda.component').then(m => m.AgendaComponent)
      },
      {
        path: 'bris-de-glace',
        loadComponent: () =>
          import('./bris-de-glace/bris-de-glace.component').then(m => m.BrisDeGlaceComponent)
      },
      {
        path: 'orientations',
        loadComponent: () =>
          import('./orientations/orientations.component').then(m => m.OrientationsComponent)
      },
      {
        path: 'referencements',
        loadComponent: () =>
          import('./referencements/referencements.component').then(m => m.MedecinReferencementsComponent)
      },
      {
        path: 'messagerie',
        loadComponent: () =>
          import('./messagerie/messagerie.component').then(m => m.MessagerieComponent)
      }
    ]
  }
];

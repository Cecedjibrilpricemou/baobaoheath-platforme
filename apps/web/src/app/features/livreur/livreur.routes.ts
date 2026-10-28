import { Routes } from '@angular/router';

export const LIVREUR_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('../../shared/components/livreur-layout/livreur-layout.component')
        .then((m) => m.LivreurLayoutComponent),
    children: [
      { path: '', redirectTo: 'courses', pathMatch: 'full' },
      {
        path: 'courses',
        loadComponent: () =>
          import('./courses/courses.component').then((m) => m.LivreurCoursesComponent),
      },
      {
        path: 'mes-courses',
        loadComponent: () =>
          import('./mes-courses/mes-courses.component').then((m) => m.LivreurMesCoursesComponent),
      },
    ],
  },
];

// app.routes.ts
import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [

  // ── Landing page (publique) ─────────────────────────────────────────
  {
    path: '',
    loadComponent: () =>
      import('./features/landing/landing.component').then(m => m.LandingComponent)
  },

  // ── Module Auth ─────────────────────────────────────────────────────
  {
    path: 'auth',
    loadChildren: () =>
      import('./features/auth/auth.routes').then(m => m.AUTH_ROUTES)
  },

  // ── Module Patient ──────────────────────────────────────────────────
  {
    path: 'patient',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['PATIENT'] },
    loadChildren: () =>
      import('./features/patient/patient.routes').then(m => m.PATIENT_ROUTES)
  },

  // ── Module ASC ──────────────────────────────────────────────────────
  {
    path: 'asc',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ASC', 'ASC_SUPERVISOR'] },
    loadChildren: () =>
      import('./features/asc/asc.routes').then(m => m.ASC_ROUTES)
  },

  // ── Module Médecin ──────────────────────────────────────────────────
  {
    path: 'medecin',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['MEDECIN'] },
    loadChildren: () =>
      import('./features/medecin/medecin.routes').then(m => m.MEDECIN_ROUTES)
  },

  // ── Module Admin ────────────────────────────────────────────────────
  {
    path: 'admin',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMIN_STRUCTURE', 'ADMIN_REGIONAL', 'ADMIN_NATIONAL', 'SUPER_ADMIN'] },
    loadChildren: () =>
      import('./features/admin/admin.routes').then(m => m.ADMIN_ROUTES)
  },

  // ── Unauthorized ────────────────────────────────────────────────────
  {
    path: 'unauthorized',
    loadComponent: () =>
      import('./shared/components/unauthorized/unauthorized.component')
        .then(m => m.UnauthorizedComponent)
  },

  // ── Wildcard ────────────────────────────────────────────────────────
  {
    path: '**',
    redirectTo: ''
  }
];
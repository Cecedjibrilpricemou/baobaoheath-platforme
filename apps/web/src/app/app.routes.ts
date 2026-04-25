// app.routes.ts
// Rôle : définit toutes les routes principales de l'application.
// Chaque feature est chargée en lazy loading pour optimiser les performances.
// Les guards protègent les routes privées et vérifient les rôles.

import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [

    // ── Redirection par défaut ──────────────────────────────────────────
    {
        path: '',
        redirectTo: 'auth/login',
        pathMatch: 'full'
    },

    // ── Module Auth (public — pas de guard) ────────────────────────────
    {
        path: 'auth',
        loadChildren: () =>
            import('./features/auth/auth.routes').then(m => m.AUTH_ROUTES)
    },

    // ── Module Patient (PATIENT uniquement) ────────────────────────────
    {
        path: 'patient',
        canActivate: [authGuard, roleGuard],
        data: { roles: ['PATIENT'] },
        loadChildren: () =>
            import('./features/patient/patient.routes').then(m => m.PATIENT_ROUTES)
    },

    // ── Module ASC (ASC + ASC_SUPERVISOR) ──────────────────────────────
    {
        path: 'asc',
        canActivate: [authGuard, roleGuard],
        data: { roles: ['ASC', 'ASC_SUPERVISOR'] },
        loadChildren: () =>
            import('./features/asc/asc.routes').then(m => m.ASC_ROUTES)
    },

    // ── Module Médecin (MEDECIN uniquement) ────────────────────────────
    {
        path: 'medecin',
        canActivate: [authGuard, roleGuard],
        data: { roles: ['MEDECIN'] },
        loadChildren: () =>
            import('./features/medecin/medecin.routes').then(m => m.MEDECIN_ROUTES)
    },

    // ── Module Admin (tous les rôles Admin + SUPER_ADMIN) ──────────────
    {
        path: 'admin',
        canActivate: [authGuard, roleGuard],
        data: { roles: ['ADMIN_STRUCTURE', 'ADMIN_REGIONAL', 'ADMIN_NATIONAL', 'SUPER_ADMIN'] },
        loadChildren: () =>
            import('./features/admin/admin.routes').then(m => m.ADMIN_ROUTES)
    },

    // ── Page accès refusé (pas de guard) ───────────────────────────────
    {
        path: 'unauthorized',
        loadComponent: () =>
            import('./shared/components/unauthorized/unauthorized.component')
                .then(m => m.UnauthorizedComponent)
    },

    // ── Wildcard : toute route inconnue → login ─────────────────────────
    {
        path: '**',
        redirectTo: 'auth/login'
    }
];
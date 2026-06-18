// features/auth/auth.routes.ts
// Rôle : définit les routes du module Auth (login + register)
// Ces routes sont publiques — aucun guard requis

import { Routes } from '@angular/router';

export const AUTH_ROUTES: Routes = [
    {
        // Route par défaut du module auth → redirige vers login
        path: '',
        redirectTo: 'login',
        pathMatch: 'full'
    },
    {
        path: 'login',
        loadComponent: () =>
            import('./login/login.component').then(m => m.LoginComponent)
    },
    {
        path: 'register',
        loadComponent: () =>
            import('./register/register.component').then(m => m.RegisterComponent)
    },
    {
        path: 'forgot-password',
        loadComponent: () =>
            import('./forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent)
    },
    {
        path: 'reset-password',
        loadComponent: () =>
            import('./reset-password/reset-password.component').then(m => m.ResetPasswordComponent)
    }
];
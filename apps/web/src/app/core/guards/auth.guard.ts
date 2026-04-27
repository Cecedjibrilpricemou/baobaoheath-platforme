// core/guards/auth.guard.ts
// Rôle : protège les routes privées — si l'utilisateur n'est pas connecté,
// il est redirigé vers /auth/login automatiquement.

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
    // Injection du service Auth et du Router
    const authService = inject(AuthService);
    const router = inject(Router);

    // Vérifie si l'utilisateur est authentifié via le signal computed
    if (authService.isAuthenticated()) {
        // ✅ Connecté → accès autorisé à la route
        return true;
    }

    // ❌ Non connecté → redirection vers login
    // On conserve l'URL demandée dans queryParams pour rediriger après login
    router.navigate(['/auth/login'], {
        queryParams: { returnUrl: state.url }
    });

    return false;
};
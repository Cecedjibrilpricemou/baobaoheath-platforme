// core/guards/role.guard.ts
// Rôle : protège les routes par rôle utilisateur.
// Chaque route déclare les rôles autorisés dans data: { roles: [...] }
// Ce guard vérifie que le rôle de l'utilisateur connecté est dans la liste.

import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Role } from '../models/user.model';

export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    // Récupère les rôles autorisés déclarés dans la config de la route
    // Exemple : data: { roles: ['MEDECIN', 'ADMIN_NATIONAL'] }
    const allowedRoles: Role[] = route.data?.['roles'] ?? [];

    // Récupère le rôle de l'utilisateur connecté via le signal computed
    const userRole = authService.userRole();

    // Si aucun rôle requis défini sur la route → accès libre
    if (allowedRoles.length === 0) {
        return true;
    }

    // Vérifie que l'utilisateur est connecté et que son rôle est autorisé
    if (userRole && allowedRoles.includes(userRole)) {
        // ✅ Rôle autorisé → accès accordé
        return true;
    }

    // ❌ Rôle non autorisé → redirection vers une page d'accès refusé
    // ou vers le dashboard selon le rôle
    router.navigate(['/unauthorized']);
    return false;
};
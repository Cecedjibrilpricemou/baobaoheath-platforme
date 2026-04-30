// core/guards/role.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Role } from '../models/user.model';

export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const authService = inject(AuthService);
  const router      = inject(Router);

  const allowedRoles: Role[] = route.data?.['roles'] ?? [];
  const userRole = authService.userRole();

  // Pas de restriction de rôle → accès libre
  if (allowedRoles.length === 0) return true;

  // Rôle autorisé → accès accordé
  if (userRole && allowedRoles.includes(userRole)) return true;

  // Rôle non autorisé → rediriger vers la bonne page selon le rôle
  const redirectMap: Record<string, string> = {
    PATIENT:         '/patient/dashboard',
    ASC:             '/asc/consultations',
    ASC_SUPERVISOR:  '/asc/consultations',
    MEDECIN:         '/medecin/dashboard',
    PHARMACIEN:      '/pharmacien/scanner',
    ADMIN_STRUCTURE: '/admin-structure/dashboard',
    ADMIN_REGIONAL:  '/admin/analytics',
    ADMIN_NATIONAL:  '/admin/analytics',
    SUPER_ADMIN:     '/admin/analytics'
  };

  const redirectUrl = userRole ? (redirectMap[userRole] ?? '/unauthorized') : '/unauthorized';
  router.navigate([redirectUrl]);
  return false;
};
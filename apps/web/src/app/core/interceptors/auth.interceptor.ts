// core/interceptors/auth.interceptor.ts
// Rôle : intercepte chaque requête HTTP sortante. L'authentification est
// désormais 100% par cookies httpOnly (bb_access/bb_refresh) envoyés
// automatiquement par le navigateur — ce middleware n'a plus de token à
// injecter, il se contente d'échoer le cookie CSRF (bb_csrf, non httpOnly)
// dans l'en-tête X-CSRF-Token sur les requêtes mutantes, et de tenter un
// refresh silencieux sur 401.

import { inject } from '@angular/core';
import { HttpInterceptorFn, HttpErrorResponse, HttpRequest } from '@angular/common/http';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function readCsrfCookie(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)bb_csrf=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function withCsrfHeader<T>(req: HttpRequest<T>): HttpRequest<T> {
  if (!MUTATING_METHODS.has(req.method)) return req;
  const csrfToken = readCsrfCookie();
  return csrfToken ? req.clone({ setHeaders: { 'X-CSRF-Token': csrfToken } }) : req;
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  return next(withCsrfHeader(req)).pipe(
    catchError((error: HttpErrorResponse) => {

      // Ne jamais tenter un refresh sur les routes auth
      const isAuthRoute =
        req.url.includes('/auth/login')           ||
        req.url.includes('/auth/register')        ||
        req.url.includes('/auth/verify-otp')      ||
        req.url.includes('/auth/refresh')         ||
        req.url.includes('/auth/logout')          ||
        req.url.includes('/auth/forgot-password') ||
        req.url.includes('/auth/reset-password');

      if (error.status === 401 && !isAuthRoute) {
        return authService.refreshToken().pipe(
          // Le refresh fait tourner le cookie bb_csrf : on doit relire sa
          // valeur fraîche avant de rejouer la requête, sinon le double-submit
          // CSRF échoue avec l'ancienne valeur.
          switchMap(() => next(withCsrfHeader(req))),
          catchError(refreshError => {
            authService.logout();
            return throwError(() => refreshError);
          })
        );
      }

      // Routes auth ou autres erreurs → propager normalement
      return throwError(() => error);
    })
  );
};

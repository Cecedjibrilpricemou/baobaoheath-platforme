// core/interceptors/auth.interceptor.ts
// Rôle : intercepte chaque requête HTTP sortante et injecte automatiquement
// le token JWT dans le header Authorization si l'utilisateur est connecté.

import { inject } from '@angular/core';
import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getAccessToken();

  const authReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authReq).pipe(
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
          switchMap(() => {
            const newToken = authService.getAccessToken();
            const retryReq = req.clone({
              setHeaders: { Authorization: `Bearer ${newToken}` }
            });
            return next(retryReq);
          }),
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
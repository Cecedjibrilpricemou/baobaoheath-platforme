// core/interceptors/auth.interceptor.ts
// Rôle : intercepte chaque requête HTTP sortante et injecte automatiquement
// le token JWT dans le header Authorization si l'utilisateur est connecté.

import { inject } from '@angular/core';
import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Injection du service Auth (Angular 21 - style fonctionnel)
  const authService = inject(AuthService);

  // Récupère le token JWT stocké en mémoire via le signal
  const token = authService.getAccessToken();

  // Clone la requête en ajoutant le header Authorization si token présent
  // On ne modifie jamais la requête originale (immutabilité HTTP)
  const authReq = token
    ? req.clone({
        setHeaders: { Authorization: `Bearer ${token}` }
      })
    : req;

  // Passe la requête (modifiée ou non) au prochain handler
  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {

      // Si le serveur retourne 401 (token expiré), on tente un refresh
      if (error.status === 401) {
        return authService.refreshToken().pipe(
          switchMap(() => {
            // Retry la requête originale avec le nouveau token
            const newToken = authService.getAccessToken();
            const retryReq = req.clone({
              setHeaders: { Authorization: `Bearer ${newToken}` }
            });
            return next(retryReq);
          }),
          catchError(refreshError => {
            // Si le refresh échoue aussi → session expirée, on déconnecte
            authService.logout();
            return throwError(() => refreshError);
          })
        );
      }

      // Pour toute autre erreur HTTP, on propage l'erreur normalement
      return throwError(() => error);
    })
  );
};
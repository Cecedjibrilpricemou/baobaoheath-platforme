// app.config.ts — BaoBaoHealth v2
import { ApplicationConfig, provideZonelessChangeDetection, APP_INITIALIZER, LOCALE_ID, inject } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';

// Dates et nombres des pipes Angular en francais (« samedi 20 septembre 2026 »,
// « 12 500 »). Sans cela, DatePipe rend en anglais americain.
registerLocaleData(localeFr);
import { provideRouter, withViewTransitions } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideToastr } from 'ngx-toastr';
import { catchError, of, switchMap } from 'rxjs';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { AuthService } from './core/services/auth.service';
import { PlateformeService } from './shared/services/plateforme.service';

// Nom, logo et coordonnees de la plateforme : lus avant le premier rendu pour
// que la marque n'apparaisse jamais avec sa valeur de repli.
function initializePlateforme() {
  const plateforme = inject(PlateformeService);
  return () => plateforme.charger();
}

function initializeAuth() {
  const auth = inject(AuthService);
  // Attempt a silent token refresh on app boot. The HttpOnly cookie is sent
  // automatically; if it's missing or expired we just leave the user unauthenticated.
  return () => auth.refreshToken().pipe(
    switchMap(() => auth.fetchCurrentUser()),
    catchError(() => of(null))
  );
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    { provide: LOCALE_ID, useValue: 'fr' },
    provideRouter(routes, withViewTransitions()),
    provideHttpClient(withInterceptors([authInterceptor])),
    { provide: APP_INITIALIZER, useFactory: initializePlateforme, multi: true },
    { provide: APP_INITIALIZER, useFactory: initializeAuth, multi: true },
    provideAnimationsAsync(),
    provideToastr({
      positionClass: 'toast-top-right',
      preventDuplicates: true,
      timeOut: 4000
    })
  ]
};

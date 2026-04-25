// app.config.ts
// Rôle : configuration racine de l'application Angular 21.
// C'est ici qu'on enregistre tous les providers globaux :
// - Le router avec les routes principales
// - HttpClient avec l'intercepteur JWT
// - La gestion du cache et des animations

import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withViewTransitions } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
    providers: [

        // Optimisation de la détection de changements (Angular 21 recommandé)
        provideZoneChangeDetection({ eventCoalescing: true }),

        // Router principal avec transitions de vue activées
        // withViewTransitions() = animations fluides entre les pages
        provideRouter(routes, withViewTransitions()),

        // HttpClient global avec l'intercepteur JWT injecté automatiquement
        // authInterceptor sera appelé sur CHAQUE requête HTTP de l'app
        provideHttpClient(withInterceptors([authInterceptor])),

        // Animations asynchrones (chargées uniquement quand nécessaire)
        provideAnimationsAsync()
    ]
};
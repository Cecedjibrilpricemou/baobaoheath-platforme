// app.config.ts
// Rôle : configuration racine de l'application Angular 21.
// Angular 21 est zoneless — on utilise provideZonelessChangeDetection
// Providers globaux : Router, HttpClient + intercepteur JWT, PrimeNG, Animations

import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withViewTransitions } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeuix/themes/aura';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
    providers: [

        // Zoneless change detection — Angular 21 (pas besoin de Zone.js)
        // Utilise les Signals pour détecter les changements automatiquement
        provideZonelessChangeDetection(),

        // Router principal avec transitions de vue fluides entre les pages
        provideRouter(routes, withViewTransitions()),

        // HttpClient global avec l'intercepteur JWT injecté sur chaque requête
        provideHttpClient(withInterceptors([authInterceptor])),

        // Animations asynchrones requises par PrimeNG
        provideAnimationsAsync(),

        // PrimeNG — thème Aura moderne et professionnel
        // ripple: true → effet visuel de clic sur les boutons PrimeNG
        providePrimeNG({
            theme: {
                preset: Aura,
                options: {
                    // cssLayer: false → styles PrimeNG disponibles globalement
                    cssLayer: false
                }
            },
            ripple: true
        })
    ]
};
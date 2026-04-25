// app.ts
// Rôle : composant racine de l'application BaoBaoHealth.
// C'est le point d'entrée visuel — il contient uniquement le <router-outlet>
// qui affiche le composant correspondant à la route active.
// Tout le reste (navbar, sidebar) sera géré dans chaque feature module.

import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  // Sélecteur utilisé dans index.html : <app-root>
  selector: 'app-root',

  // Standalone component — pas besoin de NgModule en Angular 21
  standalone: true,

  // RouterOutlet est le seul import nécessaire ici
  // Il affiche dynamiquement le composant de la route active
  imports: [RouterOutlet],

  // Template inline minimaliste — chaque page gère son propre layout
  template: `<router-outlet />`
})
export class AppComponent {
  // Titre de l'application (référencé dans app.config.ts si besoin)
  title = 'BaoBaoHealth';
}
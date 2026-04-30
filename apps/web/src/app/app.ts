// app.ts — BaoBaoHealth v2
// Injecte ThemeService au démarrage pour appliquer le thème stocké
import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './shared/services/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: '<router-outlet />',
  styles: []
})
export class AppComponent {
  // Injection suffit : ThemeService applique le thème via effect() dans son constructeur
  readonly theme = inject(ThemeService);
}

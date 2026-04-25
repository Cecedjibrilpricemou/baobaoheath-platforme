// shared/components/unauthorized/unauthorized.component.ts
// Rôle : page affichée quand un utilisateur tente d'accéder
// à une route pour laquelle il n'a pas le rôle requis.

import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-unauthorized',
  standalone: true,
  template: `
    <div class="unauthorized">
      <h1>⛔ Accès refusé</h1>
      <p>Vous n'avez pas les droits pour accéder à cette page.</p>
      <button (click)="goBack()">Retour</button>
    </div>
  `,
  styles: [`
    .unauthorized {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      gap: 1rem;
      font-family: sans-serif;
    }
  `]
})
export class UnauthorizedComponent {
  private router = inject(Router);

  goBack() {
    this.router.navigate(['/auth/login']);
  }
}
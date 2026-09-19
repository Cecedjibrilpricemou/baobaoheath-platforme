// shared/components/brand/brand.component.ts
// Marque de la plateforme : logo (s'il est televerse) + nom, lus dans les
// parametres. Utilise dans les barres laterales, la landing et les pages
// d'authentification. La taille se regle par variables CSS depuis le parent :
//   --bb-brand-logo (hauteur du logo, 1.75em) et --bb-brand-size (taille du nom,
//   1em : la classe posee sur <app-brand> par le parent fixe donc la taille).
import { Component, inject } from '@angular/core';
import { PlateformeService } from '../../services/plateforme.service';

@Component({
  selector: 'app-brand',
  standalone: true,
  template: `
    @if (plateforme.logoUrl()) {
      <img class="bb-brand__logo" [src]="plateforme.logoUrl()" [alt]="plateforme.nom()" />
    }
    <span class="bb-brand__name">{{ plateforme.nom() }}</span>
  `,
  styles: [`
    :host { display: inline-flex; align-items: center; gap: 8px; min-width: 0; color: inherit; }
    .bb-brand__logo { height: var(--bb-brand-logo, 1.75em); width: auto; max-width: 140px; object-fit: contain; display: block; }
    .bb-brand__name {
      font-family: var(--bb-font-display); font-size: var(--bb-brand-size, 1em); font-weight: 800;
      letter-spacing: -0.3px; color: inherit; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
  `],
})
export class BrandComponent {
  readonly plateforme = inject(PlateformeService);
}

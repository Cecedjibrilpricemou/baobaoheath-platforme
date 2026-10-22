// shared/components/public-shell/public-shell.component.ts
// Cadre des pages publiques d'information (confidentialite, conditions,
// securite, professionnels, a propos) : navigation commune (PublicNav) et
// pied de page dans le langage de la page d'accueil, contenu projete entre
// les deux. Styles : styles/_public.scss.
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { BrandComponent } from '../brand/brand.component';
import { PublicNavComponent } from '../public-nav/public-nav.component';
import { PlateformeService } from '../../services/plateforme.service';

@Component({
  selector: 'app-public-shell',
  standalone: true,
  imports: [RouterLink, TranslatePipe, BrandComponent, PublicNavComponent],
  templateUrl: './public-shell.component.html',
})
export class PublicShellComponent {
  readonly plateforme = inject(PlateformeService);
}

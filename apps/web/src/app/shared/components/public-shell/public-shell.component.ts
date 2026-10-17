// shared/components/public-shell/public-shell.component.ts
// Cadre des pages publiques d'information (confidentialite, conditions,
// securite, professionnels, a propos) : barre de navigation et pied de page
// dans le langage de la page d'accueil, contenu projete entre les deux.
// Aucune logique propre : theme et langue passent par les memes services
// que la landing. Styles : styles/_public.scss.
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ThemeService } from '../../services/theme.service';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { BrandComponent } from '../brand/brand.component';
import { PlateformeService } from '../../services/plateforme.service';

@Component({
  selector: 'app-public-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, TranslatePipe, BrandComponent],
  templateUrl: './public-shell.component.html',
})
export class PublicShellComponent implements OnInit {
  readonly themeService = inject(ThemeService);
  readonly plateforme   = inject(PlateformeService);
  private i18nService   = inject(I18nService);

  // Le routeur ne remonte pas en haut de page : arriver depuis le pied de
  // page de l'accueil laisserait le visiteur en bas du nouveau document.
  ngOnInit() {
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
  }

  toggleTheme() { this.themeService.toggle(); }
  toggleLang()  { this.i18nService.toggle(); }
}

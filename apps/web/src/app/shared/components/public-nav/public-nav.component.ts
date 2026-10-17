// shared/components/public-nav/public-nav.component.ts
// Navigation unique du site public (accueil + pages d'information) : memes
// liens partout, menu mobile, onglet actif fiable.
//
// - Liens de section (« Comment ca marche », « Structures ») : routerLink
//   vers l'accueil + fragment ; le routeur fait defiler jusqu'a l'ancre
//   (anchorScrolling, app.config.ts), depuis n'importe quelle page.
// - Onglet actif : sur les pages, routerLinkActive ; sur l'accueil, la
//   section visible a l'ecran (IntersectionObserver), plus de soulignement
//   fige sur « Accueil ».
// - Menu mobile (< 960px) : panneau ouvert par le bouton ☰, referme au
//   clic sur un lien, a la touche Echap ou au changement de page.
// Styles : styles/_public.scss (.pub-nav).
import { Component, DestroyRef, afterNextRender, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { ViewportScroller } from '@angular/common';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ThemeService } from '../../services/theme.service';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { BrandComponent } from '../brand/brand.component';

/** Sections de l'accueil suivies pour l'onglet actif. */
const SECTIONS = ['how', 'structures', 'contact'] as const;
type Section = typeof SECTIONS[number];

/** Hauteur de la barre collante : les ancres s'arretent juste dessous. */
const DECALAGE_ANCRE = 76;

@Component({
  selector: 'app-public-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, TranslatePipe, BrandComponent],
  templateUrl: './public-nav.component.html',
  host: { '(document:keydown.escape)': 'fermer()' },
})
export class PublicNavComponent {
  readonly themeService = inject(ThemeService);
  private i18nService = inject(I18nService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  readonly menuOuvert = signal(false);
  /** Section de l'accueil actuellement a l'ecran (null hors accueil ou dans le hero). */
  readonly sectionActive = signal<Section | null>(null);

  constructor() {
    inject(ViewportScroller).setOffset([0, DECALAGE_ANCRE]);

    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      takeUntilDestroyed(),
    ).subscribe(() => this.fermer());

    // Suivi des sections, seulement sur l'accueil et une fois le rendu fait.
    afterNextRender(() => {
      const cibles = SECTIONS
        .map(id => document.getElementById(id))
        .filter((el): el is HTMLElement => !!el);
      if (!cibles.length || typeof IntersectionObserver === 'undefined') return;

      // Ligne de reference au milieu de l'ecran : la section qui la traverse est active.
      const observateur = new IntersectionObserver(entrees => {
        for (const e of entrees) {
          if (e.isIntersecting) this.sectionActive.set(e.target.id as Section);
          else if (this.sectionActive() === e.target.id) this.sectionActive.set(null);
        }
      }, { rootMargin: '-45% 0px -54% 0px' });

      cibles.forEach(c => observateur.observe(c));
      this.destroyRef.onDestroy(() => observateur.disconnect());
    });
  }

  basculerMenu() { this.menuOuvert.update(v => !v); }
  fermer()       { this.menuOuvert.set(false); }

  toggleTheme() { this.themeService.toggle(); }
  toggleLang()  { this.i18nService.toggle(); }
}

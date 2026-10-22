// shared/services/layout.service.ts
import { DOCUMENT } from '@angular/common';
import { Injectable, effect, inject, signal } from '@angular/core';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

/** Seuil unique, aligné sur les media queries de styles/_shell.scss. */
export const SEUIL_MOBILE = '(max-width: 768px)';

/**
 * Expose l'état responsive de la coquille applicative.
 *
 * Les six layouts de rôle partagent la même barre latérale : sans ce service
 * chacun réimplémenterait sa propre détection, avec le risque que le seuil CSS
 * et le seuil TypeScript divergent.
 */
@Injectable({ providedIn: 'root' })
export class LayoutService {
  private breakpoints = inject(BreakpointObserver);

  private document = inject(DOCUMENT);

  /** Vrai en dessous de 768px : la barre latérale passe alors en superposition. */
  readonly estMobile = toSignal(
    this.breakpoints.observe(SEUIL_MOBILE).pipe(map(resultat => resultat.matches)),
    { initialValue: false }
  );

  /**
   * Barre repliée : les icônes seules, sans les libellés.
   *
   * **L'état vit ici et nulle part ailleurs.** Les huit layouts de rôle
   * partagent la même barre ; un signal par layout voudrait dire que replier
   * dans l'espace du médecin ne replierait pas dans celui de l'accueil, et
   * qu'un agent qui change d'écran retrouverait sa barre dépliée.
   *
   * Conservé d'une session à l'autre : c'est une préférence de poste de
   * travail, pas un geste à refaire chaque matin.
   */
  readonly repliee = signal(this.lireChoix());

  constructor() {
    // La classe est posée sur `<html>` plutôt que passée à huit gabarits :
    // le style est le même partout, et le CSS sait déjà s'en servir.
    effect(() => {
      const racine = this.document.documentElement;
      racine.classList.toggle('bb-nav-repliee', this.repliee());
      try {
        localStorage.setItem(CLE_REPLI, this.repliee() ? '1' : '0');
      } catch {
        // Navigation privée, stockage bloqué : on replie quand même, on ne
        // s'en souviendra simplement pas.
      }
    });
  }

  basculerRepli(): void {
    this.repliee.update(v => !v);
  }

  private lireChoix(): boolean {
    try {
      return localStorage.getItem(CLE_REPLI) === '1';
    } catch {
      return false;
    }
  }
}

const CLE_REPLI = 'bb-nav-repliee';

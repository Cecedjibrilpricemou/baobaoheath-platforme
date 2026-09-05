// shared/services/layout.service.ts
import { Injectable, inject } from '@angular/core';
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

  /** Vrai en dessous de 768px : la barre latérale passe alors en superposition. */
  readonly estMobile = toSignal(
    this.breakpoints.observe(SEUIL_MOBILE).pipe(map(resultat => resultat.matches)),
    { initialValue: false }
  );
}

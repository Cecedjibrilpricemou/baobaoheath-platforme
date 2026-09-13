// shared/components/topbar-crumb/topbar-crumb.component.ts
// Fil d'Ariane de la barre superieure : « Espace / Page ». Le libelle de la
// page est deduit des entrees de navigation du layout (prefixe de route le
// plus long), pas d'une table a maintenir a part. Remplace l'ancien champ
// « Rechercher » qui ne cherchait rien.
import { Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { TranslatePipe } from '../../pipes/translate.pipe';

export interface CrumbNavItem {
  labelKey: string;
  route: string;
}

@Component({
  selector: 'app-topbar-crumb',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <div class="bb-crumb">
      <span class="bb-crumb__root">{{ rootKey() | translate }}</span>
      @if (pageLabelKey(); as key) {
        <span class="bb-crumb__sep" aria-hidden="true">/</span>
        <span class="bb-crumb__page">{{ key | translate }}</span>
      }
    </div>
  `,
})
export class TopbarCrumbComponent {
  /** Cle i18n de l'espace (ex. 'PATIENT.ROLE'). */
  rootKey = input.required<string>();
  /** Entrees de navigation du layout : route -> cle i18n. */
  items = input.required<CrumbNavItem[]>();

  private router = inject(Router);
  private url = signal(this.router.url);

  readonly pageLabelKey = computed(() => {
    const url = this.url().split('?')[0];
    const match = [...this.items()]
      .sort((a, b) => b.route.length - a.route.length)
      .find(i => url === i.route || url.startsWith(i.route + '/'));
    return match?.labelKey ?? null;
  });

  constructor() {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd), takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(e => this.url.set(e.urlAfterRedirects));
  }
}

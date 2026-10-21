import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminService } from '../../../core/services/admin.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { I18nService } from '../../../shared/services/i18n.service';
import { AuthService } from '../../../core/services/auth.service';
import type { AssureurView } from '@baobaoheath/shared-types';

@Component({
  selector: 'app-admin-structure-assurances',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <header class="bb-page-head">
      <div class="bb-page-head__text">
        <span class="bb-page-head__tag"><i class="pi pi-shield" aria-hidden="true"></i> {{ (isPharmacien() ? 'PHARMACIEN.ROLE' : 'ADMIN_STRUCTURE.ROLE') | translate }}</span>
        <h1 class="bb-page-head__title">{{ 'ADMIN_STRUCTURE.ASSURANCES.TITLE' | translate }}</h1>
        <p class="bb-page-head__sub">{{ 'ADMIN_STRUCTURE.ASSURANCES.SUBTITLE' | translate }}</p>
      </div>
    </header>

    @if (error()) {
      <div class="bb-agents__alert bb-agents__alert--error" role="alert">{{ error() }}</div>
    }
    @if (conventionsHeritees()) {
      <div class="bb-agents__alert bb-agents__alert--success bb-assurances__inherited" role="status">{{ 'ADMIN_STRUCTURE.ASSURANCES.INHERITED_NOTICE' | translate }}</div>
    }
    @if (loading()) {
      @for (i of [1,2,3]; track i) { <div class="bb-skeleton" style="height:72px;border-radius:8px"></div> }
    } @else if (assureurs().length === 0) {
      <div class="bb-agents__empty">
        <i class="pi pi-shield" aria-hidden="true"></i>
        <p>{{ 'ADMIN_STRUCTURE.ASSURANCES.EMPTY' | translate }}</p>
      </div>
    } @else {
      <div class="bb-agents__list">
        @for (assureur of assureurs(); track assureur.id) {
          <article class="bb-agents__item">
            <div class="bb-agents__avatar" aria-hidden="true"><i class="pi pi-shield"></i></div>
            <div class="bb-agents__info">
              <h2 class="bb-agents__name">{{ assureur.nom }}</h2>
              <p class="bb-agents__contact">{{ assureur.code }} · {{ 'ADMIN_STRUCTURE.ASSURANCES.RULES_COUNT' | translate: { count: assureur.regles.length } }}</p>
            </div>
            @if (conventions().has(assureur.id)) {
              <span class="bb-badge bb-badge--success">
                {{ (conventionsHeriteesMap().has(assureur.id) ? 'ADMIN_STRUCTURE.ASSURANCES.INHERITED' : 'ADMIN_STRUCTURE.ASSURANCES.ACTIVE') | translate }}
              </span>
            }
            @if (conventionsModifiables()) {
              <button class="bb-agents__deactivate" type="button"
                [disabled]="saving() === assureur.id"
                [attr.aria-label]="(conventions().has(assureur.id) ? 'ADMIN_STRUCTURE.ASSURANCES.REMOVE' : 'ADMIN_STRUCTURE.ASSURANCES.ADD') | translate"
                (click)="basculer(assureur)">
                <i class="pi" [class.pi-plus]="!conventions().has(assureur.id)" [class.pi-ban]="conventions().has(assureur.id)" aria-hidden="true"></i>
              </button>
            }
          </article>
        }
      </div>
    }
    @if (!conventionsHeritees()) {
      <p class="bb-page-head__sub bb-assurances__note">
        {{ (isPharmacien() ? 'ADMIN_STRUCTURE.ASSURANCES.INDEPENDENT_NOTE' : 'ADMIN_STRUCTURE.ASSURANCES.INHERITANCE_NOTE') | translate }}
      </p>
    }
  `,
  styleUrl: './assurances.component.scss',
})
export class AssurancesComponent implements OnInit {
  private readonly admin = inject(AdminService);
  private readonly i18n = inject(I18nService);
  private readonly auth = inject(AuthService);

  assureurs = signal<AssureurView[]>([]);
  conventions = signal(new Set<string>());
  conventionsHeriteesMap = signal(new Set<string>());
  conventionsModifiables = signal(false);
  conventionsHeritees = signal(false);
  loading = signal(true);
  saving = signal<string | null>(null);
  error = signal('');

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.loading.set(true);
    this.error.set('');
    this.admin.getAssureursCatalogue().subscribe({
      next: catalogue => {
        this.admin.getAssureurs().subscribe({
          next: actives => {
            this.assureurs.set(catalogue.data?.assureurs ?? []);
            this.conventions.set(new Set((actives.data ?? []).map(assureur => assureur.id)));
            this.conventionsHeriteesMap.set(new Set((actives.data ?? [])
              .filter(assureur => assureur.conventionHeritee)
              .map(assureur => assureur.id)));
            this.conventionsModifiables.set(catalogue.data?.conventionsModifiables ?? false);
            this.conventionsHeritees.set(catalogue.data?.conventionsHeritees ?? false);
            this.loading.set(false);
          },
          error: () => this.echecChargement(),
        });
      },
      error: () => this.echecChargement(),
    });
  }

  isPharmacien(): boolean {
    return this.auth.currentUser()?.role === 'PHARMACIEN';
  }

  basculer(assureur: AssureurView): void {
    this.saving.set(assureur.id);
    this.error.set('');
    const requete = this.conventions().has(assureur.id)
      ? this.admin.retirerConventionAssureur(assureur.id)
      : this.admin.activerConventionAssureur(assureur.id);
    requete.subscribe({
      next: () => {
        this.saving.set(null);
        this.charger();
      },
      error: err => {
        this.saving.set(null);
        this.error.set(err?.error?.error ?? this.i18n.t('ADMIN_STRUCTURE.ASSURANCES.SAVE_ERROR'));
      },
    });
  }

  private echecChargement(): void {
    this.loading.set(false);
    this.error.set(this.i18n.t('ADMIN_STRUCTURE.ASSURANCES.LOAD_ERROR'));
  }
}

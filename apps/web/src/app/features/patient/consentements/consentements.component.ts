// features/patient/consentements/consentements.component.ts
// Le patient decide qui peut lire son dossier et a quelles fins (scopes de
// ConsentementPatient), et voit qui y a accede (journal d'audit).
import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ToastrService } from 'ngx-toastr';
import type { AccesDossierView, ConsentScope, ConsentementView } from '@baobaoheath/shared-types';
import { PrivacyService } from '../../../core/services/privacy.service';
import { I18nService } from '../../../shared/services/i18n.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

interface ScopeItem {
  scope: ConsentScope;
  icon: string;
  actif: boolean;
  /** Date de la derniere decision, null tant que le patient n'a rien choisi. */
  modifieLe: string | Date | null;
  saving: boolean;
}

// Ordre d'affichage : du plus structurant (acces au dossier) au plus accessoire.
const SCOPES: { scope: ConsentScope; icon: string }[] = [
  { scope: 'DOSSIER_MEDICAL',      icon: 'pi-folder-open' },
  { scope: 'RAPPELS_SMS',          icon: 'pi-mobile' },
  { scope: 'FHIR_EXPORT',          icon: 'pi-share-alt' },
  { scope: 'RECHERCHE_ANONYMISEE', icon: 'pi-chart-bar' },
];

@Component({
  selector: 'app-consentements',
  standalone: true,
  imports: [
    CommonModule, TranslatePipe,
    MatCardModule, MatIconModule, MatSlideToggleModule, MatProgressSpinnerModule,
  ],
  templateUrl: './consentements.component.html',
  styleUrl: './consentements.component.scss',
})
export class ConsentementsComponent implements OnInit {
  private privacyService = inject(PrivacyService);
  private i18n = inject(I18nService);
  private toastr = inject(ToastrService);

  scopes = signal<ScopeItem[]>(SCOPES.map(s => ({ ...s, actif: false, modifieLe: null, saving: false })));
  acces = signal<AccesDossierView[]>([]);
  totalAcces = signal(0);
  isLoading = signal(true);
  isLoadingAcces = signal(true);

  constructor(iconRegistry: MatIconRegistry) {
    iconRegistry.registerFontClassAlias('pi', 'pi');
  }

  ngOnInit() {
    this.privacyService.getMyConsents().subscribe({
      next: res => {
        this.appliquer(res.data ?? []);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.toastr.error(this.i18n.t('PATIENT.CONSENTS.ERR_LOAD'), this.i18n.t('COMMON.ERROR_TITLE'));
      }
    });

    this.privacyService.getAuditLogs(1, 20).subscribe({
      next: res => {
        this.acces.set(res.data ?? []);
        this.totalAcces.set(res.meta?.total ?? (res.data?.length ?? 0));
        this.isLoadingAcces.set(false);
      },
      error: () => { this.isLoadingAcces.set(false); }
    });
  }

  basculer(item: ScopeItem, actif: boolean) {
    this.patch(item.scope, { saving: true, actif });

    this.privacyService.updateConsent({ scope: item.scope, actif, source: 'WEB' }).subscribe({
      next: res => {
        const c = res.data;
        this.patch(item.scope, {
          saving: false,
          actif: c?.actif ?? actif,
          modifieLe: c ? (c.actif ? c.donneLe : c.retireLe) : new Date(),
        });
        this.toastr.success(
          this.i18n.t(actif ? 'PATIENT.CONSENTS.GRANTED' : 'PATIENT.CONSENTS.REVOKED'),
          this.i18n.t(`PATIENT.CONSENTS.SCOPE.${item.scope}.TITLE`)
        );
      },
      error: err => {
        // Retour a l'etat precedent : le bouton ne doit pas mentir sur ce qui est enregistre.
        this.patch(item.scope, { saving: false, actif: !actif });
        this.toastr.error(err?.error?.error ?? this.i18n.t('PATIENT.CONSENTS.ERR_SAVE'), this.i18n.t('COMMON.ERROR_TITLE'));
      }
    });
  }

  private appliquer(consentements: ConsentementView[]) {
    const parScope = new Map(consentements.map(c => [c.scope, c]));
    this.scopes.update(liste => liste.map(item => {
      const c = parScope.get(item.scope);
      return c
        ? { ...item, actif: c.actif, modifieLe: c.actif ? c.donneLe : c.retireLe }
        : item;
    }));
  }

  private patch(scope: ConsentScope, changes: Partial<ScopeItem>) {
    this.scopes.update(liste => liste.map(item => item.scope === scope ? { ...item, ...changes } : item));
  }
}

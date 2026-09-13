import { Component, OnInit, signal, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSliderModule } from '@angular/material/slider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import type {
  ParametresAlertesView,
  ParametresFacturationView,
  ParametresSecuriteView,
  ParametresSyncView,
  ParametresSystemeValeurs,
  ParametresSystemeView,
  UpdateParametresSystemeDto,
} from '@baobaoheath/shared-types';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { I18nService } from '../../../shared/services/i18n.service';
import { AdminService } from '../../../core/services/admin.service';

type Onglet = keyof ParametresSystemeValeurs;

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    MatButtonModule, MatFormFieldModule, MatInputModule, MatSlideToggleModule, MatSliderModule,
    MatProgressSpinnerModule, CommonModule, FormsModule, RouterLink, TranslatePipe
  ],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsComponent implements OnInit {
  private i18n = inject(I18nService);
  private adminService = inject(AdminService);
  private toastr = inject(ToastrService);

  // Navigation
  activeTab = signal<Onglet>('facturation');

  isLoading = signal(true);
  isSaving  = signal(false);
  modifieLe = signal<string | Date | null>(null);

  get tabs(): { id: Onglet; label: string; icon: string }[] {
    return [
      { id: 'facturation', label: this.i18n.t('ADMIN.SETTINGS.TAB_BILLING'),  icon: 'pi pi-wallet' },
      { id: 'securite',    label: this.i18n.t('ADMIN.SETTINGS.TAB_SECURITY'), icon: 'pi pi-lock' },
      { id: 'alertes',     label: this.i18n.t('ADMIN.SETTINGS.TAB_ALERTS'),   icon: 'pi pi-bolt' },
      { id: 'sync',        label: this.i18n.t('ADMIN.SETTINGS.TAB_SYNC'),     icon: 'pi pi-sync' }
    ];
  }

  // Modeles lies aux formulaires (ngModel). Remplis par GET /admin-structure/parametres,
  // renvoyes section par section par PUT — chaque onglet a son propre bouton.
  facturation: ParametresFacturationView = {
    paiementEspeces: true,
    paiementOrangeMoney: true,
    paiementMomo: false,
    margePct: 15
  };

  securite: ParametresSecuriteView = {
    consentementDefaut: true
  };

  alertes: ParametresAlertesView = {
    seuilPaludisme: 20,
    seuilEbola: 1,
    activerIA: true
  };

  sync: ParametresSyncView = {
    offlineMode: true,
    frequenceMinutes: 30,
    ussdTimeoutSecondes: 600
  };

  ngOnInit() {
    this.charger();
  }

  setTab(id: Onglet) {
    this.activeTab.set(id);
  }

  charger() {
    this.isLoading.set(true);
    this.adminService.getParametres().subscribe({
      next: res => {
        if (res.data) this.appliquer(res.data);
        this.isLoading.set(false);
      },
      error: err => {
        this.isLoading.set(false);
        this.toastr.error(err?.error?.error ?? this.i18n.t('ADMIN.SETTINGS.ERR_LOAD'), this.i18n.t('COMMON.ERROR_TITLE'));
      }
    });
  }

  /** Enregistre uniquement la section de l'onglet actif. */
  enregistrer(section: Onglet) {
    if (this.isSaving()) return;
    const payload: UpdateParametresSystemeDto = { [section]: { ...this[section] } };

    this.isSaving.set(true);
    this.adminService.updateParametres(payload).subscribe({
      next: res => {
        // La reponse fait foi : elle contient les valeurs normalisees par l'API.
        if (res.data) this.appliquer(res.data);
        this.isSaving.set(false);
        this.toastr.success(this.i18n.t('ADMIN.SETTINGS.SUCCESS_SAVED'), this.i18n.t('COMMON.SUCCESS'));
      },
      error: err => {
        this.isSaving.set(false);
        this.toastr.error(err?.error?.error ?? this.i18n.t('ADMIN.SETTINGS.ERR_SAVE'), this.i18n.t('COMMON.ERROR_TITLE'));
      }
    });
  }

  private appliquer(vue: ParametresSystemeView) {
    // Copies : ngModel mute les objets, la reponse HTTP ne doit pas etre partagee.
    this.facturation = { ...vue.facturation };
    this.securite    = { ...vue.securite };
    this.alertes     = { ...vue.alertes };
    this.sync        = { ...vue.sync };
    this.modifieLe.set(vue.modifieLe);
  }
}

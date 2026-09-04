import { Component, signal, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSliderModule } from '@angular/material/slider';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { I18nService } from '../../../shared/services/i18n.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    MatButtonModule, MatFormFieldModule, MatSelectModule, MatSlideToggleModule, MatSliderModule,
    CommonModule, FormsModule, TranslatePipe
  ],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsComponent {
  private i18n = inject(I18nService);

  // Navigation
  activeTab = signal('structure');

  get tabs() {
    return [
      { id: 'structure', label: this.i18n.t('ADMIN.SETTINGS.TAB_STRUCTURE'), icon: 'pi pi-building' },
      { id: 'security', label: this.i18n.t('ADMIN.SETTINGS.TAB_SECURITY'), icon: 'pi pi-lock' },
      { id: 'alerts', label: this.i18n.t('ADMIN.SETTINGS.TAB_ALERTS'), icon: 'pi pi-bolt' },
      { id: 'sync', label: this.i18n.t('ADMIN.SETTINGS.TAB_SYNC'), icon: 'pi pi-sync' }
    ];
  }

  // Modèles de données pour les formulaires
  structure = {
    nom: 'Hôpital Régional',
    type: 'HOPITAL_REG',
    adresse: 'Conakry, Commune de Ratoma',
    latitude: 9.6179,
    longitude: -13.5939,
    marge: 15,
    paiementEspeces: true,
    paiementOrangeMoney: true,
    paiementMomo: false,
    rappelSms: true
  };

  security = {
    force2FA: false,
    sessionTimeout: 15,
    consentementDefaut: true
  };

  alerts = {
    seuilPaludisme: 50,
    seuilEbola: 1,
    activerIA: true,
    poidsTriage: 80
  };

  sync = {
    frequence: 30, // minutes
    ussdTimeout: 120, // secondes
    offlineMode: true
  };

  get typeOptions() {
    return [
      { label: this.i18n.t('ADMIN.SETTINGS.TYPE_POSTE'), value: 'POSTE' },
      { label: this.i18n.t('ADMIN.SETTINGS.TYPE_CENTRE'), value: 'CENTRE' },
      { label: this.i18n.t('ADMIN.SETTINGS.TYPE_HOPITAL_PREF'), value: 'HOPITAL_PREF' },
      { label: this.i18n.t('ADMIN.SETTINGS.TYPE_HOPITAL_REG'), value: 'HOPITAL_REG' },
      { label: this.i18n.t('ADMIN.SETTINGS.TYPE_PHARMACIE'), value: 'PHARMACIE' }
    ];
  }

  get timeoutOptions() {
    return [
      { label: this.i18n.t('ADMIN.SETTINGS.TIMEOUT_15MIN'), value: 15 },
      { label: this.i18n.t('ADMIN.SETTINGS.TIMEOUT_30MIN'), value: 30 },
      { label: this.i18n.t('ADMIN.SETTINGS.TIMEOUT_1H'), value: 60 },
      { label: this.i18n.t('ADMIN.SETTINGS.TIMEOUT_4H'), value: 240 }
    ];
  }

  setTab(id: string) {
    this.activeTab.set(id);
  }

  sauvegarder() {
    // Simulation d'une sauvegarde
    console.log('Paramètres sauvegardés');
  }
}

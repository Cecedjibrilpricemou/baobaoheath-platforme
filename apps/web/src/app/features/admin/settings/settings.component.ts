import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { SliderModule } from 'primeng/slider';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ButtonModule, 
    ToggleSwitchModule, SelectModule, InputTextModule, SliderModule
  ],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsComponent {
  // Navigation
  activeTab = signal('structure');

  tabs = [
    { id: 'structure', label: 'Structure', icon: 'pi pi-building' },
    { id: 'security', label: 'Sécurité & Accès', icon: 'pi pi-lock' },
    { id: 'alerts', label: 'Alertes & IA', icon: 'pi pi-bolt' },
    { id: 'sync', label: 'Hors-ligne & USSD', icon: 'pi pi-sync' }
  ];

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

  typeOptions = [
    { label: 'Poste de santé', value: 'POSTE' },
    { label: 'Centre de santé', value: 'CENTRE' },
    { label: 'Hôpital Préfectoral', value: 'HOPITAL_PREF' },
    { label: 'Hôpital Régional', value: 'HOPITAL_REG' },
    { label: 'Pharmacie', value: 'PHARMACIE' }
  ];

  timeoutOptions = [
    { label: '15 minutes', value: 15 },
    { label: '30 minutes', value: 30 },
    { label: '1 heure', value: 60 },
    { label: '4 heures', value: 240 }
  ];

  setTab(id: string) {
    this.activeTab.set(id);
  }

  sauvegarder() {
    // Simulation d'une sauvegarde
    console.log('Paramètres sauvegardés');
  }
}

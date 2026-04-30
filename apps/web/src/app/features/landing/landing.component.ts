// features/landing/landing.component.ts
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { ThemeService } from '../../shared/services/theme.service';
import { I18nService } from '../../shared/services/i18n.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink, CommonModule, ButtonModule, TranslatePipe],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss'
})
export class LandingComponent {
  readonly themeService = inject(ThemeService);
  private i18nService   = inject(I18nService);

  toggleTheme() { this.themeService.toggle(); }
  toggleLang()  { this.i18nService.toggle(); }

  features = [
    { icon: 'pi-user',       title: 'Dossier patient numérique',  description: 'Centralisez toutes les données médicales — consultations, vaccins, antécédents — accessibles partout.' },
    { icon: 'pi-qrcode',     title: 'QR Code patient',            description: 'Chaque patient dispose d\'un QR Code unique permettant un accès instantané et sécurisé à son dossier.' },
    { icon: 'pi-calendar',   title: 'Planning & rendez-vous',      description: 'Gérez les agendas des agents de santé, programmez les visites et suivez les RDV en temps réel.' },
    { icon: 'pi-shield',     title: 'Carnet vaccinal',             description: 'Suivi complet des vaccinations avec rappels automatiques et historique horodaté.' },
    { icon: 'pi-box',        title: 'Gestion des stocks',          description: 'Inventaire des médicaments par poste de santé, alertes critiques et suivi des péremptions.' },
    { icon: 'pi-chart-line', title: 'Analytics & rapports',        description: 'Tableaux de bord en temps réel pour les superviseurs et administrateurs régionaux.' }
  ];

  stats = [
    { value: '9',    labelKey: 'LANDING.STAT_MODULES' },
    { value: '62',   labelKey: 'LANDING.STAT_ROUTES'  },
    { value: '8',    labelKey: 'LANDING.STAT_ROLES'   },
    { value: '100%', labelKey: 'LANDING.STAT_SECURE'  }
  ];

  roles = [
    { icon: 'pi-user',       title: 'Patient',          desc: 'Accède à son dossier, QR Code, carnet vaccinal et historique de consultations.' },
    { icon: 'pi-heart',      title: 'Agent ASC',         desc: 'Gère les consultations, le planning, les stocks et les vaccinations de sa zone.' },
    { icon: 'pi-plus-circle',title: 'Médecin',           desc: 'Supervise les cas, rédige des ordonnances et coordonne avec les agents de terrain.' },
    { icon: 'pi-box',        title: 'Pharmacien',        desc: 'Valide les prescriptions et gère les dispensations de médicaments.' },
    { icon: 'pi-chart-bar',  title: 'Superviseur',       desc: 'Surveille les indicateurs de santé communautaire et génère des rapports régionaux.' },
    { icon: 'pi-building',   title: 'Admin Structure',   desc: 'Gère les utilisateurs et les paramètres de son établissement de santé.' },
    { icon: 'pi-server',     title: 'Admin Régional',    desc: 'Vue d\'ensemble sur plusieurs structures d\'une région sanitaire.' },
    { icon: 'pi-cog',        title: 'Super Admin',       desc: 'Contrôle total du système, paramétrage global et gestion des accès.' }
  ];

  trustItems = [
    { icon: 'pi-shield', label: 'Données chiffrées et sécurisées'  },
    { icon: 'pi-mobile', label: 'Accessible sur mobile'            },
    { icon: 'pi-wifi',   label: 'Fonctionne en faible débit'       },
    { icon: 'pi-users',  label: 'Multi-rôles, un seul système'     },
    { icon: 'pi-globe',  label: 'Made for Guinea 🇬🇳'             }
  ];

  steps = [
    { num: '1', title: 'Créez votre compte',       desc: 'Inscrivez-vous avec votre numéro de téléphone en moins de 2 minutes.' },
    { num: '2', title: 'Complétez votre profil',   desc: 'Renseignez vos informations. Votre QR Code est généré automatiquement.' },
    { num: '3', title: 'Accédez à vos services',   desc: 'Dashboard personnalisé, consultations, stocks, planning — tout est prêt.' }
  ];
}

import { Component } from '@angular/core';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-features',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './features.component.html',
  styleUrl: './features.component.scss'
})
export class FeaturesComponent {
  features = [
    { icon: 'pi-user', title: 'Dossier patient numérique', description: 'Centralisez toutes les données médicales — consultations, vaccins, antécédents — accessibles partout.' },
    { icon: 'pi-qrcode', title: 'QR Code patient', description: 'Chaque patient dispose d\'un QR Code unique permettant un accès instantané et sécurisé à son dossier.' },
    { icon: 'pi-calendar', title: 'Planning & rendez-vous', description: 'Gérez les agendas des agents de santé, programmez les visites et suivez les RDV en temps réel.' },
    { icon: 'pi-shield', title: 'Carnet vaccinal', description: 'Suivi complet des vaccinations avec rappels automatiques et historique horodaté.' },
    { icon: 'pi-box', title: 'Gestion des stocks', description: 'Inventaire des médicaments par poste de santé, alertes critiques et suivi des péremptions.' },
    { icon: 'pi-chart-line', title: 'Analytics & rapports', description: 'Tableaux de bord en temps réel pour les superviseurs et administrateurs régionaux.' }
  ];
}

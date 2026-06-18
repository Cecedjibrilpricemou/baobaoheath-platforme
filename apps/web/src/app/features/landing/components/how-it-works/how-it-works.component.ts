import { Component } from '@angular/core';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-how-it-works',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './how-it-works.component.html',
  styleUrl: './how-it-works.component.scss'
})
export class HowItWorksComponent {
  steps = [
    { num: '1', title: 'Créez votre compte', desc: 'Inscrivez-vous avec votre numéro de téléphone en moins de 2 minutes.' },
    { num: '2', title: 'Complétez votre profil', desc: 'Renseignez vos informations. Votre QR Code est généré automatiquement.' },
    { num: '3', title: 'Accédez à vos services', desc: 'Dashboard personnalisé, consultations, stocks, planning — tout est prêt.' }
  ];
}

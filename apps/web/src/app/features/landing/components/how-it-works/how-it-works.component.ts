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
    { num: '01', icon: 'pi-user-plus',   titleKey: 'LANDING.HOW_STEP1_TITLE', descKey: 'LANDING.HOW_STEP1_DESC' },
    { num: '02', icon: 'pi-qrcode',      titleKey: 'LANDING.HOW_STEP2_TITLE', descKey: 'LANDING.HOW_STEP2_DESC' },
    { num: '03', icon: 'pi-check-circle', titleKey: 'LANDING.HOW_STEP3_TITLE', descKey: 'LANDING.HOW_STEP3_DESC' }
  ];
}

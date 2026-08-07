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
    { icon: 'pi-user', titleKey: 'LANDING.FEATURE_DOSSIER_TITLE', descKey: 'LANDING.FEATURE_DOSSIER_DESC' },
    { icon: 'pi-qrcode', titleKey: 'LANDING.FEATURE_QRCODE_TITLE', descKey: 'LANDING.FEATURE_QRCODE_DESC' },
    { icon: 'pi-calendar', titleKey: 'LANDING.FEATURE_PLANNING_TITLE', descKey: 'LANDING.FEATURE_PLANNING_DESC' },
    { icon: 'pi-shield', titleKey: 'LANDING.FEATURE_VACCIN_TITLE', descKey: 'LANDING.FEATURE_VACCIN_DESC' },
    { icon: 'pi-box', titleKey: 'LANDING.FEATURE_STOCKS_TITLE', descKey: 'LANDING.FEATURE_STOCKS_DESC' },
    { icon: 'pi-chart-line', titleKey: 'LANDING.FEATURE_ANALYTICS_TITLE', descKey: 'LANDING.FEATURE_ANALYTICS_DESC' }
  ];
}

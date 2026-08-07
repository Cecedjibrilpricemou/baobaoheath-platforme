import { Component } from '@angular/core';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-roles',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './roles.component.html',
  styleUrl: './roles.component.scss'
})
export class RolesComponent {
  roles = [
    { icon: 'pi-user', titleKey: 'LANDING.ROLE_PATIENT_TITLE', descKey: 'LANDING.ROLE_PATIENT_DESC' },
    { icon: 'pi-heart', titleKey: 'LANDING.ROLE_ASC_TITLE', descKey: 'LANDING.ROLE_ASC_DESC' },
    { icon: 'pi-plus-circle', titleKey: 'LANDING.ROLE_MEDECIN_TITLE', descKey: 'LANDING.ROLE_MEDECIN_DESC' },
    { icon: 'pi-box', titleKey: 'LANDING.ROLE_PHARMACIEN_TITLE', descKey: 'LANDING.ROLE_PHARMACIEN_DESC' },
    { icon: 'pi-chart-bar', titleKey: 'LANDING.ROLE_SUPERVISEUR_TITLE', descKey: 'LANDING.ROLE_SUPERVISEUR_DESC' },
    { icon: 'pi-building', titleKey: 'LANDING.ROLE_ADMIN_STRUCTURE_TITLE', descKey: 'LANDING.ROLE_ADMIN_STRUCTURE_DESC' },
    { icon: 'pi-server', titleKey: 'LANDING.ROLE_ADMIN_REGIONAL_TITLE', descKey: 'LANDING.ROLE_ADMIN_REGIONAL_DESC' },
    { icon: 'pi-cog', titleKey: 'LANDING.ROLE_SUPER_ADMIN_TITLE', descKey: 'LANDING.ROLE_SUPER_ADMIN_DESC' }
  ];
}

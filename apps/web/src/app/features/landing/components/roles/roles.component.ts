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
    { icon: 'pi-user', title: 'Patient', desc: 'Accède à son dossier, QR Code, carnet vaccinal et historique de consultations.' },
    { icon: 'pi-heart', title: 'Agent ASC', desc: 'Gère les consultations, le planning, les stocks et les vaccinations de sa zone.' },
    { icon: 'pi-plus-circle', title: 'Médecin', desc: 'Supervise les cas, rédige des ordonnances et coordonne avec les agents de terrain.' },
    { icon: 'pi-box', title: 'Pharmacien', desc: 'Valide les prescriptions et gère les dispensations de médicaments.' },
    { icon: 'pi-chart-bar', title: 'Superviseur', desc: 'Surveille les indicateurs de santé communautaire et génère des rapports régionaux.' },
    { icon: 'pi-building', title: 'Admin Structure', desc: 'Gère les utilisateurs et les paramètres de son établissement de santé.' },
    { icon: 'pi-server', title: 'Admin Régional', desc: 'Vue d\'ensemble sur plusieurs structures d\'une région sanitaire.' },
    { icon: 'pi-cog', title: 'Super Admin', desc: 'Contrôle total du système, paramétrage global et gestion des accès.' }
  ];
}

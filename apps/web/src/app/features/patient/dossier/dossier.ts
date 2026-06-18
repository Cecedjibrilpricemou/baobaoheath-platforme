import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimelineModule } from 'primeng/timeline';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-dossier',
  standalone: true,
  imports: [CommonModule, TimelineModule, CardModule, TagModule, ButtonModule],
  templateUrl: './dossier.html',
  styleUrl: './dossier.scss',
})
export class Dossier {
  // Mock data pour la timeline (historique médical)
  historique = signal([
    {
      date: '12 Mai 2026',
      type: 'Consultation Générale',
      medecin: 'Dr. Ousmane Diallo',
      diagnostic: 'Paludisme simple',
      statut: 'Terminé',
      color: '#3EBB70',
      icon: 'pi pi-check'
    },
    {
      date: '04 Fév 2026',
      type: 'Urgence',
      medecin: 'Dr. Aissatou Bah',
      diagnostic: 'Gastro-entérite aiguë',
      statut: 'Terminé',
      color: '#F59E0B',
      icon: 'pi pi-exclamation-triangle'
    },
    {
      date: '10 Nov 2025',
      type: 'Visite de routine',
      medecin: 'Agent Aminata Sylla',
      diagnostic: 'Bilan de santé OK',
      statut: 'Terminé',
      color: '#3EBB70',
      icon: 'pi pi-heart'
    }
  ]);

  // Mock data pour les vaccins
  vaccins = signal([
    { nom: 'Fièvre Jaune', date: '10 Nov 2025', statut: 'À jour', severity: 'success' },
    { nom: 'Hépatite B', date: '15 Jan 2026', statut: 'À jour', severity: 'success' },
    { nom: 'Tétanos', date: 'Rappel prévu', statut: 'En retard', severity: 'danger' }
  ]);
}

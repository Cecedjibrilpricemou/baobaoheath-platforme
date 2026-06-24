import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimelineModule } from 'primeng/timeline';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { PatientService } from '../../../core/services/patient.service';
import { VaccinationService } from '../../../core/services/vaccination.service';
import { Consultation, Vaccination } from '../../../core/models/patient.model';

interface TimelineItem {
  date: string;
  type: string;
  medecin: string;
  diagnostic: string;
  statut: string;
  color: string;
  icon: string;
}

interface VaccinItem {
  nom: string;
  date: string;
  statut: string;
  severity: 'success' | 'warn' | 'danger';
}

const STATUT_STYLE: Record<string, { label: string; color: string; icon: string }> = {
  TERMINEE:   { label: 'Terminé',    color: '#3EBB70', icon: 'pi pi-check' },
  EN_COURS:   { label: 'En cours',   color: '#F59E0B', icon: 'pi pi-clock' },
  PLANIFIEE:  { label: 'Planifiée',  color: '#3B82F6', icon: 'pi pi-calendar' },
  ANNULEE:    { label: 'Annulée',    color: '#EF4444', icon: 'pi pi-times' },
  REFERENCEE: { label: 'Référencée', color: '#8B5CF6', icon: 'pi pi-share-alt' },
};

@Component({
  selector: 'app-dossier',
  standalone: true,
  imports: [CommonModule, TimelineModule, CardModule, TagModule, ButtonModule],
  templateUrl: './dossier.html',
  styleUrl: './dossier.scss',
})
export class Dossier implements OnInit {
  private patientService = inject(PatientService);
  private vaccinationService = inject(VaccinationService);

  historique = signal<TimelineItem[]>([]);
  vaccins = signal<VaccinItem[]>([]);

  ngOnInit() {
    this.loadHistorique();
    this.loadVaccins();
  }

  private loadHistorique() {
    this.patientService.getMyConsultations(20).subscribe({
      next: (response) => {
        const items = response?.data?.items ?? [];
        this.historique.set(items.map((c) => this.toTimelineItem(c)));
      },
      error: () => {},
    });
  }

  private toTimelineItem(c: Consultation): TimelineItem {
    const style = STATUT_STYLE[c.statut] ?? { label: c.statut, color: '#64748B', icon: 'pi pi-circle' };
    const intervenant = c.medecin?.utilisateur
      ? `Dr. ${c.medecin.utilisateur.prenom} ${c.medecin.utilisateur.nom}`
      : c.asc?.utilisateur
        ? `Agent ${c.asc.utilisateur.prenom} ${c.asc.utilisateur.nom}`
        : '—';
    return {
      date: this.formatDate(c.consulteeLE),
      type: c.motifPrincipal || 'Consultation',
      medecin: intervenant,
      diagnostic: c.diagnostics?.[0]?.libelle ?? 'Diagnostic non renseigné',
      statut: style.label,
      color: style.color,
      icon: style.icon,
    };
  }

  private loadVaccins() {
    this.vaccinationService.getMyVaccinations().subscribe({
      next: (response) => {
        const items = response?.data ?? [];
        this.vaccins.set(items.map((v) => this.toVaccinItem(v)));
      },
      error: () => {},
    });
  }

  private toVaccinItem(v: Vaccination): VaccinItem {
    const rappel = v.prochaineDose ?? v.dateProchaineD;
    let statut: VaccinItem['statut'] = 'À jour';
    let severity: VaccinItem['severity'] = 'success';
    if (rappel) {
      if (new Date(rappel) < new Date()) {
        statut = 'En retard';
        severity = 'danger';
      } else {
        statut = 'Rappel prévu';
        severity = 'warn';
      }
    }
    return {
      nom: v.nomVaccin ?? v.vaccinNom ?? '—',
      date: this.formatDate(v.dateAdministration),
      statut,
      severity,
    };
  }

  private formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}

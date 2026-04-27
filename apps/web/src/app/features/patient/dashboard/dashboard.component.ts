// features/patient/dashboard/dashboard.component.ts
// Corrigé pour correspondre exactement aux champs utilisés dans le template HTML
import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

interface PatientDashboard {
  id: string;
  qrCode?: string;
  dateNaissance?: string;
  sexe?: string;
  groupeSanguin?: string;
  allergies?: string[];
  maladiesChroniques?: string[];
  utilisateur?: { nom: string; prenom: string; telephone: string; };
}

// Interface alignée sur les champs utilisés dans le template HTML
interface Consultation {
  id: string;
  date: string;
  statut: string;
  motif?: string;
  asc?: { nom: string; prenom: string };
}

// Interface alignée sur les champs utilisés dans le template HTML
interface Vaccination {
  id: string;
  vaccin: string;           // mappé depuis vaccinNom du backend
  dateAdministration: string; // mappé depuis administreLe du backend
  prochainRappel?: string;  // mappé depuis dateProchaineD du backend
}

interface RendezVous {
  id: string;
  date: string;
  motif?: string;
  statut: string;
}

interface Facture {
  id: string;
  montantGnf: number;
  statut: string;
  creeLe: string;
  modePaiement?: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, CardModule, TagModule, ButtonModule, SkeletonModule, TranslatePipe],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  private api         = inject(ApiService);
  private authService = inject(AuthService);

  currentUser = this.authService.currentUser;

  patientProfil      = signal<PatientDashboard | null>(null);
  consultations      = signal<Consultation[]>([]);   // garde le signal pour le template
  vaccinations       = signal<Vaccination[]>([]);
  factures           = signal<Facture[]>([]);
  prochainRdv        = signal<RendezVous | null>(null);
  isLoading          = signal(true);
  errorMessage       = signal('');
  totalConsultations = signal(0);  // garde le signal pour le template
  totalVaccinations  = signal(0);
  prochainsRappels   = signal(0);

  ngOnInit() { this.loadDashboard(); }

  private loadDashboard() {
    this.isLoading.set(true);

    // Profil patient — GET /patients/me (autorisé PATIENT)
    this.api.get<any>('/patients/me').subscribe({
      next: (response) => {
        const data = response?.data ?? response;
        this.patientProfil.set(data);
        this.isLoading.set(false);
      },
      error: () => { this.isLoading.set(false); }
    });

    // Carnet vaccinal — GET /vaccinations/me (autorisé PATIENT)
    this.api.get<any>('/vaccinations/me').subscribe({
      next: (response) => {
        const raw = Array.isArray(response) ? response : response?.data ?? [];
        // Mapper les champs backend → champs attendus par le template
        const list: Vaccination[] = raw.map((v: any) => ({
          id: v.id,
          vaccin: v.vaccinNom ?? v.vaccin ?? '—',
          dateAdministration: v.administreLe ?? v.dateAdministration,
          prochainRappel: v.dateProchaineD ?? v.prochainRappel
        }));
        this.vaccinations.set(list.slice(0, 3));
        this.totalVaccinations.set(list.length);
        const dans30j = new Date();
        dans30j.setDate(dans30j.getDate() + 30);
        this.prochainsRappels.set(
          list.filter(v => v.prochainRappel && new Date(v.prochainRappel) <= dans30j).length
        );
      },
      error: () => {}
    });

    // Paiements — GET /paiements/historique (autorisé PATIENT)
    this.api.get<any>('/paiements/historique').subscribe({
      next: (response) => {
        const list = Array.isArray(response) ? response : response?.data ?? [];
        this.factures.set(list.slice(0, 3));
      },
      error: () => {}
    });
  }

  exportDossier() {
    this.api.get<any>('/patients/me/export').subscribe({
      next: (data) => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dossier-medical-${this.currentUser()?.nom ?? 'patient'}.json`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => {}
    });
  }

  // Méthodes utilisées dans le template
  getStatutSeverity(statut: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    const map: Record<string, 'success' | 'info' | 'warn' | 'danger' | 'secondary'> = {
      'TERMINEE':   'success',
      'EN_COURS':   'warn',
      'PLANIFIEE':  'info',
      'ANNULEE':    'danger',
      'REFERENCEE': 'secondary'
    };
    return map[statut] ?? 'secondary';
  }

  getStatutLabel(statut: string): string {
    const map: Record<string, string> = {
      'TERMINEE':   'Terminée',
      'EN_COURS':   'En cours',
      'PLANIFIEE':  'Planifiée',
      'ANNULEE':    'Annulée',
      'REFERENCEE': 'Référencée'
    };
    return map[statut] ?? statut;
  }

  getStatutFactureSeverity(statut: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    const map: Record<string, 'success' | 'info' | 'warn' | 'danger' | 'secondary'> = {
      'PAYEE':      'success',
      'EN_ATTENTE': 'warn',
      'PARTIELLE':  'info',
      'ANNULEE':    'danger',
      'REMBOURSEE': 'secondary'
    };
    return map[statut] ?? 'secondary';
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  formatMontant(montant: number): string {
    return new Intl.NumberFormat('fr-GN', {
      style: 'currency', currency: 'GNF', maximumFractionDigits: 0
    }).format(montant);
  }

  getInitiales(): string {
    const user = this.currentUser();
    const prenom = this.patientProfil()?.utilisateur?.prenom ?? user?.prenom ?? '';
    const nom    = this.patientProfil()?.utilisateur?.nom    ?? user?.nom    ?? '';
    return `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase() || '??';
  }

  getAllergies(): string {
    const a = this.patientProfil()?.allergies;
    if (!a || a.length === 0) return 'Aucune allergie connue';
    return a.join(', ');
  }
}

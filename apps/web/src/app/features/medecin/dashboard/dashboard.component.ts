// features/medecin/dashboard/dashboard.component.ts
import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { MedecinService } from '../../../core/services/medecin.service';
import { AuthService } from '../../../core/services/auth.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

interface DashboardStats {
  consultationsValidees: number;
  consultationsEnAttente: number;
  referencementsEnAttente: number;
  messagesNonLus: number;
  structure: { nom: string; type: string; prefecture: string } | null;
}

interface ConsultationRecente {
  id: string;
  statut: string;
  motifPrincipal: string;
  consulteeLE: string;
  patient?: { utilisateur: { prenom: string; nom: string; } };
  asc?: { utilisateur: { prenom: string; nom: string; } };
}

@Component({
  selector: 'app-medecin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, CardModule, TagModule, ButtonModule, SkeletonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class MedecinDashboardComponent implements OnInit {
  private medecinService = inject(MedecinService);
  private authService    = inject(AuthService);

  currentUser          = this.authService.currentUser;
  stats                = signal<DashboardStats | null>(null);
  consultationsRecentes = signal<ConsultationRecente[]>([]);
  isLoading            = signal(true);

  ngOnInit() { this.loadDashboard(); }

  private loadDashboard() {
    this.isLoading.set(true);

    // Stats dashboard
    this.medecinService.getDashboard().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.stats.set(response.data as unknown as DashboardStats);
        }
        this.isLoading.set(false);
      },
      error: () => { this.isLoading.set(false); }
    });

    // Consultations récentes à valider
    this.medecinService.getConsultationsRecentes().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.consultationsRecentes.set(response.data as ConsultationRecente[]);
        }
      },
      error: () => {}
    });
  }

  getPatientNom(c: ConsultationRecente): string {
    const u = c.patient?.utilisateur;
    return u ? `${u.prenom} ${u.nom}` : '—';
  }

  getAscNom(c: ConsultationRecente): string {
    const u = c.asc?.utilisateur;
    return u ? `${u.prenom} ${u.nom}` : '—';
  }

  getInitiales(): string {
    const u = this.currentUser();
    if (!u) return '??';
    return `${u.prenom?.charAt(0) ?? ''}${u.nom?.charAt(0) ?? ''}`.toUpperCase();
  }

  formatDate(d: string): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}

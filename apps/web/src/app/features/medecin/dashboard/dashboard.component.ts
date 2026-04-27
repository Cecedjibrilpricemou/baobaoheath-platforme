// features/medecin/dashboard/dashboard.component.ts
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
  imports: [CommonModule, RouterLink, CardModule, TagModule, ButtonModule, SkeletonModule, TranslatePipe],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class MedecinDashboardComponent implements OnInit {
  private api         = inject(ApiService);
  private authService = inject(AuthService);

  currentUser          = this.authService.currentUser;
  stats                = signal<DashboardStats | null>(null);
  consultationsRecentes = signal<ConsultationRecente[]>([]);
  isLoading            = signal(true);

  ngOnInit() { this.loadDashboard(); }

  private loadDashboard() {
    this.isLoading.set(true);

    // Stats dashboard
    this.api.get<any>('/medecin/dashboard').subscribe({
      next: (r) => {
        this.stats.set(r?.data ?? r);
        this.isLoading.set(false);
      },
      error: () => { this.isLoading.set(false); }
    });

    // Consultations récentes à valider
    this.api.get<any>('/medecin/consultations?limit=5').subscribe({
      next: (r) => {
        const data = Array.isArray(r) ? r : r?.data ?? [];
        this.consultationsRecentes.set(data.slice(0, 5));
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

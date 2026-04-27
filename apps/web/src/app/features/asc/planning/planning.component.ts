// features/asc/planning/planning.component.ts
import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { ApiService } from '../../../core/services/api.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

interface RendezVous {
  id: string; date: string; heure?: string; motif?: string; statut: string;
  patient?: { utilisateur: { nom: string; prenom: string; telephone: string; }; };
}

@Component({
  selector: 'app-planning',
  standalone: true,
  imports: [CommonModule, ButtonModule, TagModule, SkeletonModule, TranslatePipe],
  templateUrl: './planning.component.html',
  styleUrl: './planning.component.scss'
})
export class PlanningComponent implements OnInit {
  private api = inject(ApiService);

  rendezVous    = signal<RendezVous[]>([]);
  isLoading     = signal(true);
  errorMessage  = signal('');
  totalRdv      = signal(0);
  rdvAujourdhui = signal(0);
  rdvCetteSemaine = signal(0);
  vue           = signal<'liste' | 'aujourd-hui'>('liste');

  ngOnInit() { this.loadPlanning(); }

  private loadPlanning() {
    this.isLoading.set(true);
    this.api.get<any>('/asc/planning').subscribe({
      next: (response) => {
        const data = Array.isArray(response) ? response : response?.data ?? [];
        this.rendezVous.set(data);
        this.totalRdv.set(data.length);
        const today = new Date().toDateString();
        this.rdvAujourdhui.set(data.filter((r: RendezVous) => new Date(r.date).toDateString() === today).length);
        const now = new Date();
        const endWeek = new Date(now);
        endWeek.setDate(now.getDate() + 7);
        this.rdvCetteSemaine.set(data.filter((r: RendezVous) => { const d = new Date(r.date); return d >= now && d <= endWeek; }).length);
        this.isLoading.set(false);
      },
      error: () => { this.isLoading.set(false); }
    });
  }

  get rdvFiltres(): RendezVous[] {
    if (this.vue() === 'aujourd-hui') {
      const today = new Date().toDateString();
      return this.rendezVous().filter(r => new Date(r.date).toDateString() === today);
    }
    return this.rendezVous();
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  }

  formatHeure(dateStr: string): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  isAujourdhui(dateStr: string): boolean {
    return new Date(dateStr).toDateString() === new Date().toDateString();
  }

  isPasse(dateStr: string): boolean { return new Date(dateStr) < new Date(); }

  getStatutSeverity(statut: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    const map: Record<string, 'success' | 'info' | 'warn' | 'danger' | 'secondary'> = {
      'PLANIFIE': 'info', 'CONFIRME': 'success', 'ANNULE': 'danger', 'TERMINE': 'secondary'
    };
    return map[statut] ?? 'secondary';
  }

  getStatutLabel(statut: string): string {
    const map: Record<string, string> = {
      'PLANIFIE': 'Planifié', 'CONFIRME': 'Confirmé', 'ANNULE': 'Annulé', 'TERMINE': 'Terminé'
    };
    return map[statut] ?? statut;
  }

  getInitiales(rdv: RendezVous): string {
    const u = rdv.patient?.utilisateur;
    if (!u) return '??';
    return `${u.prenom?.charAt(0) ?? ''}${u.nom?.charAt(0) ?? ''}`.toUpperCase();
  }
}

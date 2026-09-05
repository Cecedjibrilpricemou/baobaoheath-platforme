// features/asc/planning/planning.component.ts
import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AscService } from '../../../core/services/asc.service';
import type { HorodatageApi, RendezVousAscView } from '@baobaoheath/shared-types';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';


@Component({
  selector: 'app-planning',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './planning.component.html',
  styleUrl: './planning.component.scss'
})
export class PlanningComponent implements OnInit {
  private ascService = inject(AscService);

  rendezVous    = signal<RendezVousAscView[]>([]);
  isLoading     = signal(true);
  errorMessage  = signal('');
  totalRdv      = signal(0);
  rdvAujourdhui = signal(0);
  rdvCetteSemaine = signal(0);
  vue           = signal<'liste' | 'aujourd-hui'>('liste');

  ngOnInit() { this.loadPlanning(); }

  private loadPlanning() {
    this.isLoading.set(true);
    this.ascService.getPlanning().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const data = response.data as RendezVousAscView[];
          this.rendezVous.set(data);
          this.totalRdv.set(data.length);
          const today = new Date().toDateString();
          this.rdvAujourdhui.set(data.filter((r) => new Date(r.prevuLe).toDateString() === today).length);
          const now = new Date();
          const endWeek = new Date(now);
          endWeek.setDate(now.getDate() + 7);
          this.rdvCetteSemaine.set(data.filter((r) => { const d = new Date(r.prevuLe); return d >= now && d <= endWeek; }).length);
        }
        this.isLoading.set(false);
      },
      error: () => { this.isLoading.set(false); }
    });
  }

  get rdvFiltres(): RendezVousAscView[] {
    if (this.vue() === 'aujourd-hui') {
      const today = new Date().toDateString();
      return this.rendezVous().filter(r => new Date(r.prevuLe).toDateString() === today);
    }
    return this.rendezVous();
  }

  formatDate(dateStr: HorodatageApi): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  }

  formatHeure(dateStr: HorodatageApi): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  isAujourdhui(dateStr: HorodatageApi): boolean {
    return new Date(dateStr).toDateString() === new Date().toDateString();
  }

  isPasse(dateStr: HorodatageApi): boolean { return new Date(dateStr) < new Date(); }

  /** Variante de badge correspondant au statut d'un rendez-vous. */
  getStatutVariante(statut: string): string {
    const map: Record<string, string> = {
      'PLANIFIE': 'info', 'CONFIRME': 'success', 'ANNULE': 'danger', 'TERMINE': 'neutral'
    };
    return map[statut] ?? 'neutral';
  }

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

  getInitiales(rdv: RendezVousAscView): string {
    const u = rdv.patient?.utilisateur;
    if (!u) return '??';
    return `${u.prenom?.charAt(0) ?? ''}${u.nom?.charAt(0) ?? ''}`.toUpperCase();
  }
}

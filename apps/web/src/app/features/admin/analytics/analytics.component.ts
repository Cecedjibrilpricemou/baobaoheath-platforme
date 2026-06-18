// features/admin/analytics/analytics.component.ts
import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { SelectModule } from 'primeng/select';
import { AdminService } from '../../../core/services/admin.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

interface KPIs {
  totalPatients: number;
  totalConsultations: number;
  totalVaccinations: number;
  totalReferencements: number;
  totalAsc: number;
}

interface StatutCount { statut: string; count: number; }
interface Pathologie { pathologie: string; count: number; }

interface DashboardData {
  kpis: KPIs;
  consultationsParStatut: StatutCount[];
  topPathologies: Pathologie[];
}

interface HeatmapPoint {
  prefecture: string;
  count: number;
  latitude?: number;
  longitude?: number;
}

interface Alerte {
  pathologie: string;
  count: number;
  prefecture: string;
  evolution: number;
}

interface Tendance {
  periode: string;
  consultations: number;
  vaccinations: number;
}

interface Couverture {
  vaccin: string;
  total: number;
  pourcentage?: number;
}

interface StructureCount {
  type: string;
  count: number;
}

interface StatsStructures {
  total: number;
  parType: StructureCount[];
}

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ButtonModule, TagModule, SkeletonModule, SelectModule],
  templateUrl: './analytics.component.html',
  styleUrl: './analytics.component.scss'
})
export class AnalyticsComponent implements OnInit {
  private adminService = inject(AdminService);

  dashboard = signal<DashboardData | null>(null);
  heatmap = signal<HeatmapPoint[]>([]);
  alertes = signal<Alerte[]>([]);
  tendances = signal<Tendance[]>([]);
  couverture = signal<Couverture[]>([]);
  statsStructures = signal<StatsStructures | null>(null);

  isLoadingDash = signal(true);
  isLoadingHeatmap = signal(true);
  isLoadingAlertes = signal(true);
  isLoadingTend = signal(true);
  isLoadingCouv = signal(true);
  isLoadingStructures = signal(true);

  activeTab = signal<'kpis' | 'heatmap' | 'alertes' | 'tendances' | 'vaccins'>('kpis');

  prefiltreOptions = [
    { label: 'Toute la Guinée', value: '' },
    { label: 'Conakry', value: 'Conakry' },
    { label: 'Kindia', value: 'Kindia' },
    { label: 'Boké', value: 'Boké' },
    { label: 'Mamou', value: 'Mamou' },
    { label: 'Labé', value: 'Labé' },
    { label: 'Faranah', value: 'Faranah' },
    { label: 'Kankan', value: 'Kankan' },
    { label: 'Nzérékoré', value: 'Nzérékoré' }
  ];
  prefiltreSelectionne = '';

  readonly typeLabels: Record<string, string> = {
    'CHU': 'CHU',
    'HOPITAL_REG': 'Hôpitaux Régionaux',
    'HOPITAL_PREF': 'Hôpitaux Préfectoraux',
    'CENTRE': 'Centres de Santé',
    'POSTE': 'Postes de Santé',
    'CLINIQUE': 'Cliniques Privées',
    'PHARMACIE': 'Pharmacies'
  };

  readonly typeColors: Record<string, string> = {
    'CHU': '#EF4444',
    'HOPITAL_REG': '#F97316',
    'HOPITAL_PREF': '#EAB308',
    'CENTRE': '#3B82F6',
    'POSTE': '#8B5CF6',
    'CLINIQUE': '#22C55E',
    'PHARMACIE': '#3EBB70'
  };

  ngOnInit() { this.loadAll(); }

  loadAll() {
    this.loadDashboard();
    this.loadHeatmap();
    this.loadAlertes();
    this.loadTendances();
    this.loadCouverture();
    this.loadStatsStructures();
  }

  private loadDashboard() {
    this.isLoadingDash.set(true);
    const params = this.prefiltreSelectionne ? { prefecture: this.prefiltreSelectionne } : undefined;
    this.adminService.getAnalyticsDashboard(params).subscribe({
      next: (response) => { 
        if (response.success && response.data) this.dashboard.set(response.data as unknown as DashboardData);
        this.isLoadingDash.set(false); 
      },
      error: () => { this.isLoadingDash.set(false); }
    });
  }

  private loadHeatmap() {
    this.isLoadingHeatmap.set(true);
    this.adminService.getAnalyticsHeatmap().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const data = response.data;
          const map = new Map<string, number>();
          (Array.isArray(data) ? data : []).forEach((p) => {
            const pref = (p as { prefecture?: string }).prefecture ?? 'Inconnue';
            map.set(pref, (map.get(pref) ?? 0) + 1);
          });
          const points: HeatmapPoint[] = Array.from(map.entries())
            .map(([prefecture, count]) => ({ prefecture, count }))
            .sort((a, b) => b.count - a.count);
          this.heatmap.set(points);
        }
        this.isLoadingHeatmap.set(false);
      },
      error: () => { this.isLoadingHeatmap.set(false); }
    });
  }

  private loadAlertes() {
    this.isLoadingAlertes.set(true);
    this.adminService.getAnalyticsAlertes().subscribe({
      next: (response) => { 
        if (response.success && response.data) this.alertes.set(response.data as unknown as Alerte[]);
        this.isLoadingAlertes.set(false); 
      },
      error: () => { this.isLoadingAlertes.set(false); }
    });
  }

  private loadTendances() {
    this.isLoadingTend.set(true);
    this.adminService.getAnalyticsTendances().subscribe({
      next: (response) => { 
        if (response.success && response.data) this.tendances.set(response.data as unknown as Tendance[]);
        this.isLoadingTend.set(false); 
      },
      error: () => { this.isLoadingTend.set(false); }
    });
  }

  private loadCouverture() {
    this.isLoadingCouv.set(true);
    this.adminService.getAnalyticsCouverture().subscribe({
      next: (response) => { 
        if (response.success && response.data) this.couverture.set(response.data as unknown as Couverture[]);
        this.isLoadingCouv.set(false); 
      },
      error: () => { this.isLoadingCouv.set(false); }
    });
  }

  // ── Utilise la route publique accessible sans restriction de rôle
  private loadStatsStructures() {
    this.isLoadingStructures.set(true);
    this.adminService.getPublicStructures().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const structures = response.data;
          const counts = new Map<string, number>();
          structures.forEach((s) => {
            const type = (s as { type?: string }).type ?? 'INCONNU';
            counts.set(type, (counts.get(type) ?? 0) + 1);
          });
          const parType: StructureCount[] = Array.from(counts.entries())
            .map(([type, count]) => ({ type, count }))
            .sort((a, b) => b.count - a.count);
          this.statsStructures.set({ total: structures.length, parType });
        }
        this.isLoadingStructures.set(false);
      },
      error: () => { this.isLoadingStructures.set(false); }
    });
  }

  onPrefiltreChange() { this.loadDashboard(); this.loadHeatmap(); }

  getTypeIcon(type: string): string {
    const map: Record<string, string> = {
      'CHU': 'pi-building', 'HOPITAL_REG': 'pi-building',
      'HOPITAL_PREF': 'pi-building', 'CENTRE': 'pi-heart-fill',
      'POSTE': 'pi-home', 'CLINIQUE': 'pi-plus-circle',
      'PHARMACIE': 'pi-box'
    };
    return map[type] ?? 'pi-building';
  }

  getTypeLabel(type: string): string { return this.typeLabels[type] ?? type; }
  getTypeColor(type: string): string { return this.typeColors[type] ?? '#6B7280'; }

  getStatutLabel(s: string): string {
    const map: Record<string, string> = {
      'EN_COURS': 'En cours', 'TERMINEE': 'Terminée',
      'PLANIFIEE': 'Planifiée', 'ANNULEE': 'Annulée', 'REFERENCEE': 'Référencée'
    };
    return map[s] ?? s;
  }

  getStatutColor(s: string): string {
    const map: Record<string, string> = {
      'EN_COURS': '#F97316', 'TERMINEE': '#22C55E',
      'PLANIFIEE': '#3B82F6', 'ANNULEE': '#EF4444', 'REFERENCEE': '#8B5CF6'
    };
    return map[s] ?? '#6B7280';
  }

  getBarWidth(count: number, max: number): number {
    return max > 0 ? Math.round((count / max) * 100) : 0;
  }

  getMaxHeatmap(): number { return Math.max(...this.heatmap().map(p => p.count), 1); }
  getMaxPathologie(): number { return Math.max(...(this.dashboard()?.topPathologies ?? []).map(p => p.count), 1); }
  getMaxStatut(): number { return Math.max(...(this.dashboard()?.consultationsParStatut ?? []).map(s => s.count), 1); }
  getMaxStructure(): number { return Math.max(...(this.statsStructures()?.parType ?? []).map(s => s.count), 1); }

  getAlerteSeverity(evolution: number): 'danger' | 'warn' | 'success' {
    if (evolution > 50) return 'danger';
    if (evolution > 20) return 'warn';
    return 'success';
  }
}
import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SkeletonModule } from 'primeng/skeleton';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

interface Stats {
  structure: { nom: string; type: string; prefecture: string };
  totalAgents: number; totalConsultations: number; totalPatients: number;
}

@Component({
  selector: 'app-admin-structure-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, SkeletonModule, TranslatePipe],
  template: `
<div class="bb-as-dash">
  <div class="bb-as-dash__header">
    @if (stats()) {
      <h1 class="bb-as-dash__title">{{ stats()!.structure.nom }}</h1>
      <p class="bb-as-dash__sub">{{ stats()!.structure.prefecture }} · {{ stats()!.structure.type }}</p>
    } @else {
      <p-skeleton width="300px" height="32px" />
    }
  </div>
  <div class="bb-as-dash__stats">
    <div class="bb-as-dash__stat">
      <i class="pi pi-users"></i>
      <div class="bb-as-dash__stat-val">{{ stats()?.totalAgents ?? 0 }}</div>
      <div class="bb-as-dash__stat-lbl">{{ 'ADMIN_STRUCTURE.DASHBOARD.ACTIVE_AGENTS' | translate }}</div>
      <a routerLink="/admin-structure/agents" class="bb-as-dash__stat-link">{{ 'ADMIN_STRUCTURE.DASHBOARD.MANAGE_LINK' | translate }}</a>
    </div>
    <div class="bb-as-dash__stat">
      <i class="pi pi-heart-fill"></i>
      <div class="bb-as-dash__stat-val">{{ stats()?.totalConsultations ?? 0 }}</div>
      <div class="bb-as-dash__stat-lbl">{{ 'ADMIN_STRUCTURE.DASHBOARD.CONSULTATIONS' | translate }}</div>
    </div>
    <div class="bb-as-dash__stat">
      <i class="pi pi-user"></i>
      <div class="bb-as-dash__stat-val">{{ stats()?.totalPatients ?? 0 }}</div>
      <div class="bb-as-dash__stat-lbl">{{ 'ADMIN_STRUCTURE.DASHBOARD.PATIENTS_LINKED' | translate }}</div>
    </div>
  </div>
</div>`,
  styles: [`
.bb-as-dash { padding: 1.5rem; max-width: 900px; margin: 0 auto; }
.bb-as-dash__header { margin-bottom: 1.5rem; }
.bb-as-dash__title { font-size: 1.25rem; font-weight: 700; margin: 0 0 0.25rem; }
.bb-as-dash__sub { font-size: 0.8rem; color: var(--p-text-muted-color, #6b7280); margin: 0; }
.bb-as-dash__stats { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem; }
.bb-as-dash__stat { background: var(--p-surface-0, #fff); border: 1px solid var(--p-surface-200, #e5e7eb); border-radius: 0.875rem; padding: 1.25rem; text-align: center; }
.bb-as-dash__stat i { font-size: 1.5rem; color: #3EBB70; display: block; margin-bottom: 0.5rem; }
.bb-as-dash__stat-val { font-size: 2rem; font-weight: 800; }
.bb-as-dash__stat-lbl { font-size: 0.8rem; color: var(--p-text-muted-color, #6b7280); }
.bb-as-dash__stat-link { display: block; font-size: 0.75rem; color: #3EBB70; text-decoration: none; margin-top: 0.5rem; font-weight: 600; }
`]
})
export class AdminStructureDashboardComponent implements OnInit {
  private api = inject(ApiService);
  stats = signal<Stats | null>(null);
  ngOnInit() {
    this.api.get<{ data?: Stats }>('/admin-structure/stats').subscribe({
      next: r => this.stats.set(r?.data ?? null),
      error: () => {}
    });
  }
}

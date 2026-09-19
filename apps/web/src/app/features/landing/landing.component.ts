// features/landing/landing.component.ts
// Page d'accueil publique : hero, chiffres de la plateforme, trois etapes,
// structures de sante (carrousel automatique), appel a l'action, contact.
import { Component, inject, OnInit, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { StructurePubliqueView } from '@baobaoheath/shared-types';
import { ThemeService } from '../../shared/services/theme.service';
import { I18nService } from '../../shared/services/i18n.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { ApiService } from '../../core/services/api.service';
import { PlateformeService } from '../../shared/services/plateforme.service';
import { HowItWorksComponent } from './components/how-it-works/how-it-works.component';
import { ContactComponent } from './components/contact/contact.component';
import { BrandComponent } from '../../shared/components/brand/brand.component';

interface PublicStats {
  patients: number;
  consultations: number;
  asc: number;
  structures: number;
}

const ICONES_TYPE: Record<string, string> = {
  POSTE: 'pi-home',
  CENTRE: 'pi-building',
  HOPITAL_PREF: 'pi-building-columns',
  HOPITAL_REG: 'pi-building-columns',
  CHU: 'pi-building-columns',
  CLINIQUE: 'pi-heart',
  PHARMACIE: 'pi-shopping-bag',
};

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [BrandComponent, RouterLink, CommonModule, FormsModule, TranslatePipe, HowItWorksComponent, ContactComponent],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss'
})
export class LandingComponent implements OnInit {
  readonly themeService = inject(ThemeService);
  readonly plateforme   = inject(PlateformeService);
  private i18nService  = inject(I18nService);
  private api          = inject(ApiService);

  // ── Chiffres de la plateforme (GET /stats/public) ───────────────────
  private platformStats = signal<PublicStats | null>(null);

  readonly stats = computed(() => {
    const s = this.platformStats();
    return [
      { icon: 'pi-users',      value: s ? this.formatCount(s.patients) : '—',      labelKey: 'LANDING.STAT_PATIENTS' },
      { icon: 'pi-heart-fill', value: s ? this.formatCount(s.consultations) : '—', labelKey: 'LANDING.STAT_CONSULTATIONS' },
      { icon: 'pi-id-card',    value: s ? this.formatCount(s.asc) : '—',           labelKey: 'LANDING.STAT_ASC' },
      { icon: 'pi-building',   value: s ? s.structures.toString() : '—',          labelKey: 'LANDING.STAT_STRUCTURES' },
    ];
  });

  // ── Structures de sante (GET /admin-structure/structures/publiques) ──
  structures = signal<StructurePubliqueView[]>([]);
  isLoadingStructures = signal(true);
  recherche = signal('');

  /** Filtre client : nom, prefecture, adresse. Vide = toutes. */
  readonly structuresFiltrees = computed(() => {
    const q = this.recherche().trim().toLowerCase();
    const liste = this.structures();
    if (!q) return liste;
    return liste.filter(s =>
      s.nom.toLowerCase().includes(q) ||
      s.prefecture.toLowerCase().includes(q) ||
      (s.adresse ?? '').toLowerCase().includes(q)
    );
  });

  /**
   * Le carrousel defile en boucle par translation CSS : on double la liste
   * pour que la fin rejoigne le debut sans saut. Inutile (et immobile) sous
   * quatre cartes : tout tient a l'ecran.
   */
  readonly piste = computed(() => {
    const liste = this.structuresFiltrees();
    return liste.length > 4 ? [...liste, ...liste] : liste;
  });
  readonly defileAuto = computed(() => this.structuresFiltrees().length > 4);

  ngOnInit(): void {
    this.chargerStats();
    this.chargerStructures();
  }

  private chargerStats(): void {
    this.api.get<{ success: boolean; data: PublicStats }>('/stats/public').subscribe({
      next: (r) => { if (r.success && r.data) this.platformStats.set(r.data); },
      error: () => { /* les tirets restent */ }
    });
  }

  private chargerStructures(): void {
    this.api.get<{ success: boolean; data: StructurePubliqueView[] }>('/admin-structure/structures/publiques').subscribe({
      next: (r) => { this.structures.set(r.data ?? []); this.isLoadingStructures.set(false); },
      error: () => { this.isLoadingStructures.set(false); }
    });
  }

  private formatCount(n: number): string {
    if (n >= 1000) return `${(n / 1000).toFixed(1).replace('.0', '')}k+`;
    return n > 0 ? `${n}+` : '0';
  }

  iconeType(type: string): string {
    return ICONES_TYPE[type] ?? 'pi-building';
  }

  libelleType(type: string): string {
    return this.i18nService.t(`LANDING.STRUCT_TYPE_${type}`);
  }

  // ── Navbar ────────────────────────────────────────────────────────
  toggleTheme() { this.themeService.toggle(); }
  toggleLang()  { this.i18nService.toggle(); }
}

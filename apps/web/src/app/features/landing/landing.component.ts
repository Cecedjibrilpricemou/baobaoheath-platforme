// features/landing/landing.component.ts
import {
  Component, inject, OnInit, OnDestroy, AfterViewInit,
  ElementRef, signal, computed
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { ThemeService } from '../../shared/services/theme.service';
import { I18nService } from '../../shared/services/i18n.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { ApiService } from '../../core/services/api.service';

import { FeaturesComponent } from './components/features/features.component';
import { RolesComponent } from './components/roles/roles.component';
import { HowItWorksComponent } from './components/how-it-works/how-it-works.component';
import { ContactComponent } from './components/contact/contact.component';

interface PublicStats {
  patients: number;
  consultations: number;
  asc: number;
  structures: number;
}

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [
    RouterLink, CommonModule, ButtonModule, TranslatePipe,
    FeaturesComponent, RolesComponent, HowItWorksComponent, ContactComponent
  ],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss'
})
export class LandingComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly themeService = inject(ThemeService);
  private i18nService  = inject(I18nService);
  private el           = inject(ElementRef);
  private api          = inject(ApiService);

  // ── Carousel ────────────────────────────────────────────────────
  readonly SLIDE_COUNT = 5;
  readonly SLIDE_DELAY = 5000;

  activeSlide  = signal(0);
  private carouselTimer?: ReturnType<typeof setInterval>;
  slideIndices = Array.from({ length: this.SLIDE_COUNT }, (_, i) => i);

  // ── Platform stats (API) ─────────────────────────────────────────
  private platformStats = signal<PublicStats | null>(null);

  readonly stats = computed(() => {
    const s = this.platformStats();
    return [
      {
        value: s ? this.formatCount(s.patients) : '—',
        labelKey: 'LANDING.STAT_PATIENTS'
      },
      {
        value: s ? this.formatCount(s.consultations) : '—',
        labelKey: 'LANDING.STAT_CONSULTATIONS'
      },
      {
        value: s ? this.formatCount(s.asc) : '—',
        labelKey: 'LANDING.STAT_ASC'
      },
      {
        value: s ? s.structures.toString() : '—',
        labelKey: 'LANDING.STAT_STRUCTURES'
      }
    ];
  });

  // ── Trust bar ────────────────────────────────────────────────────
  trustItems = [
    { icon: 'pi-shield',  labelKey: 'LANDING.TRUST_SECURE' },
    { icon: 'pi-mobile',  labelKey: 'LANDING.TRUST_MOBILE' },
    { icon: 'pi-wifi',    labelKey: 'LANDING.TRUST_OFFLINE' },
    { icon: 'pi-users',   labelKey: 'LANDING.TRUST_MULTIROLE' },
    { icon: 'pi-globe',   labelKey: 'LANDING.TRUST_MADE' }
  ];

  // ── Lifecycle ────────────────────────────────────────────────────
  ngOnInit(): void {
    this.startCarousel();
    this.loadPlatformStats();
  }

  ngAfterViewInit(): void {
    requestAnimationFrame(() => {
      const hero = this.el.nativeElement.querySelector('.hero');
      if (hero) hero.classList.add('anim-ready');
    });
  }

  ngOnDestroy(): void {
    this.stopCarousel();
  }

  // ── API stats ────────────────────────────────────────────────────
  private loadPlatformStats(): void {
    this.api.get<{ success: boolean; data: PublicStats }>('/stats/public').subscribe({
      next: (r) => { if (r.success && r.data) this.platformStats.set(r.data); },
      error: () => { /* fallback: keep '—' placeholders */ }
    });
  }

  private formatCount(n: number): string {
    if (n >= 1000) return `${(n / 1000).toFixed(1).replace('.0', '')}k+`;
    return n > 0 ? `${n}+` : '0';
  }

  // ── Carousel helpers ─────────────────────────────────────────────
  startCarousel(): void {
    this.carouselTimer = setInterval(() => {
      this.activeSlide.update(i => (i + 1) % this.SLIDE_COUNT);
    }, this.SLIDE_DELAY);
  }

  stopCarousel(): void {
    if (this.carouselTimer) clearInterval(this.carouselTimer);
  }

  goToSlide(index: number): void {
    this.activeSlide.set(index);
    this.stopCarousel();
    this.startCarousel();
  }

  // ── Helpers navbar ───────────────────────────────────────────────
  toggleTheme() { this.themeService.toggle(); }
  toggleLang()  { this.i18nService.toggle(); }
}

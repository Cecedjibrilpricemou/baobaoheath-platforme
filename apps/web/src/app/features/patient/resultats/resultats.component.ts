// features/patient/resultats — courbe d'evolution d'une valeur d'analyse
// (EF-04-10) : une serie, la bande de reference, la lecture de chaque point.
// SVG inline, tokens partages ; une vue tableau accompagne toujours la courbe.
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ToastrService } from 'ngx-toastr';
import type { EvolutionResultatView, ExamenSuiviView, InterpretationResultat } from '@baobaoheath/shared-types';
import { LaboratoireService } from '../../../core/services/laboratoire.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { I18nService } from '../../../shared/services/i18n.service';
import { interpretationClasse } from '../../laboratoire/laboratoire.utils';

export type PointCourbe = { x: number; y: number; date: string; valeur: number; interpretation: InterpretationResultat; numero: string };

// Geometrie du trace (viewBox) ; l'element s'etire en largeur.
const L = 640, H = 260, M = { haut: 18, droite: 22, bas: 34, gauche: 46 };

@Component({
  selector: 'app-patient-resultats',
  standalone: true,
  imports: [DatePipe, TranslatePipe],
  templateUrl: './resultats.component.html',
  styleUrl: './resultats.component.scss',
})
export class ResultatsComponent implements OnInit {
  private labo   = inject(LaboratoireService);
  private toastr = inject(ToastrService);
  private i18n   = inject(I18nService);

  readonly L = L; readonly H = H; readonly M = M;
  readonly lectureClasse = interpretationClasse;

  examens    = signal<ExamenSuiviView[]>([]);
  choisi     = signal<string | null>(null);
  evolution  = signal<EvolutionResultatView | null>(null);
  isLoading  = signal(true);
  isChargeant = signal(false);
  survol     = signal<number | null>(null);

  /** Echelle Y : couvre les valeurs et la bande de reference, avec une marge. */
  readonly echelle = computed(() => {
    const e = this.evolution(); if (!e || e.points.length === 0) return null;
    const vals = e.points.map((p) => p.valeur);
    if (e.refMin !== null) vals.push(e.refMin);
    if (e.refMax !== null) vals.push(e.refMax);
    let min = Math.min(...vals), max = Math.max(...vals);
    if (min === max) { min -= 1; max += 1; }
    const marge = (max - min) * 0.12;
    min = Math.max(0, min - marge); max += marge;
    const y = (v: number) => M.haut + (H - M.haut - M.bas) * (1 - (v - min) / (max - min));
    const n = e.points.length;
    const x = (i: number) => n === 1 ? L / 2 : M.gauche + (L - M.gauche - M.droite) * (i / (n - 1));
    return { min, max, x, y };
  });

  readonly points = computed<PointCourbe[]>(() => {
    const e = this.evolution(); const s = this.echelle(); if (!e || !s) return [];
    return e.points.map((p, i) => ({ x: s.x(i), y: s.y(p.valeur), date: String(p.date), valeur: p.valeur, interpretation: p.interpretation, numero: p.numeroDemande }));
  });

  readonly trace = computed(() => this.points().map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '));

  /** Bande de reference (y haut, hauteur) ; null si aucune borne. */
  readonly bande = computed(() => {
    const e = this.evolution(); const s = this.echelle(); if (!e || !s) return null;
    if (e.refMin === null && e.refMax === null) return null;
    const haut = s.y(e.refMax ?? s.max), bas = s.y(e.refMin ?? s.min);
    return { y: haut, h: Math.max(0, bas - haut) };
  });

  /** Quatre graduations horizontales, arrondies. */
  readonly graduations = computed(() => {
    const s = this.echelle(); if (!s) return [];
    return [0, 1, 2, 3, 4].map((k) => { const v = s.min + (s.max - s.min) * (k / 4); return { y: s.y(v), label: this.formater(v) }; });
  });

  readonly dernier = computed(() => { const p = this.points(); return p.length ? p[p.length - 1] : null; });
  readonly pointSurvole = computed(() => { const i = this.survol(); const p = this.points(); return i !== null && p[i] ? p[i] : null; });

  ngOnInit() {
    this.labo.mesExamensSuivis().subscribe({
      next: (r) => {
        this.examens.set(r.data ?? []); this.isLoading.set(false);
        if (r.data?.[0]) this.choisir(r.data[0].codeLoinc);
      },
      error: (err) => { this.isLoading.set(false); this.toastr.error(err?.error?.error ?? this.i18n.t('COMMON.ERROR_GENERIC'), this.i18n.t('COMMON.ERROR_TITLE')); },
    });
  }

  choisir(codeLoinc: string) {
    if (this.choisi() === codeLoinc) return;
    this.choisi.set(codeLoinc); this.isChargeant.set(true); this.survol.set(null);
    this.labo.monEvolution(codeLoinc).subscribe({
      next: (r) => { this.evolution.set(r.data ?? null); this.isChargeant.set(false); },
      error: (err) => { this.isChargeant.set(false); this.toastr.error(err?.error?.error ?? this.i18n.t('COMMON.ERROR_GENERIC'), this.i18n.t('COMMON.ERROR_TITLE')); },
    });
  }

  /** Le point le plus proche du curseur (en x) est survole. */
  surMouvement(ev: MouseEvent) {
    const svg = ev.currentTarget as SVGSVGElement;
    const rect = svg.getBoundingClientRect();
    const x = ((ev.clientX - rect.left) / rect.width) * L;
    const p = this.points(); if (!p.length) return;
    let meilleur = 0;
    for (let i = 1; i < p.length; i++) if (Math.abs(p[i].x - x) < Math.abs(p[meilleur].x - x)) meilleur = i;
    this.survol.set(meilleur);
  }

  formater(v: number): string {
    // Une decimale suffit a l'oeil ; deux quand la valeur est petite (ex. 0,45).
    return Number.isInteger(v) ? String(v) : v.toFixed(Math.abs(v) < 1 ? 2 : 1).replace(/\.?0+$/, '');
  }
}

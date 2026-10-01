// features/pharmacien/peremptions — les lots qui approchent de leur date.
//
// Addendum du 2026-09-28, point 1.4. Les périmés d'abord : ce ne sont pas des
// lots à surveiller, ce sont des lots à retirer des rayons.
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import type { PeremptionProcheView } from '@baobaoheath/shared-types';

import { PharmacienService } from '../../../core/services/pharmacien.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { I18nService } from '../../../shared/services/i18n.service';

@Component({
  selector: 'app-pharmacien-peremptions',
  standalone: true,
  imports: [DatePipe, FormsModule, TranslatePipe],
  templateUrl: './peremptions.component.html',
  styleUrl: './peremptions.component.scss',
})
export class PeremptionsComponent implements OnInit {
  private pharma = inject(PharmacienService);
  private toastr = inject(ToastrService);
  private i18n = inject(I18nService);

  lots = signal<PeremptionProcheView[]>([]);
  isLoading = signal(true);

  /** L'horizon de surveillance, en jours. Le seuil de l'API par défaut. */
  readonly horizons = [30, 60, 90, 180];
  jours = signal(90);

  readonly perimes = computed(() => this.lots().filter((l) => l.perime));
  readonly proches = computed(() => this.lots().filter((l) => !l.perime));

  ngOnInit() {
    this.charger();
  }

  changerHorizon(j: number) {
    this.jours.set(j);
    this.charger();
  }

  private charger() {
    this.isLoading.set(true);
    this.pharma.getPeremptions(this.jours()).subscribe({
      next: (r) => {
        this.lots.set(r.data ?? []);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        const e = err as { status?: number };
        this.toastr.error(
          e?.status === 0
            ? this.i18n.t('AUTH.LOGIN.ERR_SERVEUR_INJOIGNABLE')
            : this.i18n.t('PHARMACIEN.PEREMPTIONS.ERR_LOAD'),
          this.i18n.t('COMMON.ERROR_TITLE')
        );
      },
    });
  }

  nom(l: PeremptionProcheView): string {
    return this.composer(l.medicament.libelle, l.medicament.dosage, l.medicament.forme);
  }

  /** Un nombre de jours toujours positif, le sens étant porté par le libellé. */
  jourAbsolu(l: PeremptionProcheView): number {
    return Math.abs(l.joursRestants);
  }
  /**
   * Le libelle est le nom complet du produit. On n'ajoute la forme et le
   * dosage que s'ils n'y figurent pas deja : « Doliprane 500mg · 500mg » est
   * du bruit, et un article non medicamenteux n'a ni l'un ni l'autre.
   */
  private composer(libelle: string, dosage?: string | null, forme?: string | null): string {
    const bas = libelle.toLowerCase();
    const sup = [dosage, forme].filter((x): x is string => !!x && !bas.includes(x.toLowerCase()));
    return [libelle, ...sup].join(' · ');
  }

}

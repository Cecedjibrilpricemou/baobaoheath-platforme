// features/medecin/orientations — les patients que l'accueil a orientés vers
// ce médecin (EF-03-05).
//
// Cet écran comble un défaut constaté en usage : l'orientation s'écrivait bien
// en base, mais le médecin n'en voyait jamais rien. Le patient était envoyé
// vers quelqu'un qui ne le voyait pas arriver.
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { ToastrService } from 'ngx-toastr';
import type { OrientationMedecinView } from '@baobaoheath/shared-types';

import { MedecinService } from '../../../core/services/medecin.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { I18nService } from '../../../shared/services/i18n.service';

@Component({
  selector: 'app-medecin-orientations',
  standalone: true,
  imports: [DatePipe, NgTemplateOutlet, TranslatePipe],
  templateUrl: './orientations.component.html',
  styleUrl: './orientations.component.scss',
})
export class OrientationsComponent implements OnInit {
  private service = inject(MedecinService);
  private toastr = inject(ToastrService);
  private i18n = inject(I18nService);

  orientations = signal<OrientationMedecinView[]>([]);
  isLoading = signal(true);

  /**
   * Ceux qui ont un rendez-vous d'abord, et par date la plus proche : c'est
   * l'ordre dans lequel le médecin va les voir arriver.
   */
  readonly avecRendezVous = computed(() =>
    this.orientations()
      .filter((o) => o.rendezVous)
      .sort((a, b) => +new Date(a.rendezVous!.prevuLe) - +new Date(b.rendezVous!.prevuLe))
  );

  readonly sansRendezVous = computed(() => this.orientations().filter((o) => !o.rendezVous));

  ngOnInit() {
    this.service.getOrientations().subscribe({
      next: (res) => {
        this.orientations.set(res.data ?? []);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.toastr.error(
          this.i18n.t('MEDECIN.ORIENTATIONS.ERR_LOAD'),
          this.i18n.t('COMMON.ERROR_TITLE')
        );
      },
    });
  }

  age(dateNaissance: string | Date): number | null {
    const n = new Date(dateNaissance);
    if (Number.isNaN(n.getTime())) return null;
    const now = new Date();
    let a = now.getFullYear() - n.getFullYear();
    if (now < new Date(now.getFullYear(), n.getMonth(), n.getDate())) a -= 1;
    return a;
  }

  /** Un rendez-vous déjà passé se signale : le patient aurait dû être vu. */
  estEnRetard(prevuLe: string | Date): boolean {
    return new Date(prevuLe).getTime() < Date.now();
  }
}

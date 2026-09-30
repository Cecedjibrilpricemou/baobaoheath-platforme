// features/hopital/demandes — les demandes de rendez-vous à distance que
// personne ne vise (addendum du 2026-09-28, point 6).
//
// L'accueil les oriente vers un médecin : c'est son métier, et le seul qu'il
// garde sur ce circuit. Il ne fixe pas l'heure — cela appartient au médecin.
import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { ToastrService } from 'ngx-toastr';
import type { DemandeRendezVousView } from '@baobaoheath/shared-types';

import { HopitalService, MedecinRefView } from '../../../core/services/hopital.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { I18nService } from '../../../shared/services/i18n.service';

@Component({
  selector: 'app-hopital-demandes',
  standalone: true,
  imports: [DatePipe, FormsModule, MatButtonModule, MatFormFieldModule, MatSelectModule, TranslatePipe],
  templateUrl: './demandes.component.html',
  styleUrl: './demandes.component.scss',
})
export class DemandesComponent implements OnInit {
  private hopital = inject(HopitalService);
  private toastr = inject(ToastrService);
  private i18n = inject(I18nService);

  demandes = signal<DemandeRendezVousView[]>([]);
  medecins = signal<MedecinRefView[]>([]);
  isLoading = signal(true);
  enCours = signal<string | null>(null);

  /** Le médecin choisi pour chaque demande, avant validation. */
  choix: Record<string, string> = {};

  ngOnInit() {
    this.charger();
    this.hopital.listerMedecins().subscribe({ next: (r) => this.medecins.set(r.data ?? []) });
  }

  private charger() {
    this.isLoading.set(true);
    this.hopital.demandesAOrienter().subscribe({
      next: (r) => {
        this.demandes.set(r.data ?? []);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.toastr.error(this.i18n.t('HOPITAL.DEMANDES.ERR_LOAD'), this.i18n.t('COMMON.ERROR_TITLE'));
      },
    });
  }

  orienter(d: DemandeRendezVousView) {
    const idMedecin = this.choix[d.id];
    if (this.enCours() || !idMedecin) return;
    this.enCours.set(d.id);

    this.hopital.orienterDemande(d.id, idMedecin).subscribe({
      next: () => {
        this.enCours.set(null);
        this.toastr.success(
          this.i18n.t('HOPITAL.DEMANDES.OK', { patient: `${d.patient.prenom} ${d.patient.nom}` }),
          this.i18n.t('COMMON.SUCCESS')
        );
        // Elle quitte la file : elle est maintenant dans celle du médecin.
        this.demandes.update((l) => l.filter((x) => x.id !== d.id));
      },
      error: (err) => {
        this.enCours.set(null);
        const e = err as { status?: number; error?: { error?: string } };
        this.toastr.error(
          e?.status === 0
            ? this.i18n.t('AUTH.LOGIN.ERR_SERVEUR_INJOIGNABLE')
            : e?.error?.error ?? this.i18n.t('HOPITAL.DEMANDES.ERR_ORIENTER'),
          this.i18n.t('COMMON.ERROR_TITLE')
        );
        this.charger();
      },
    });
  }

  joursDAttente(creeLe: string | Date): number {
    return Math.max(0, Math.floor((Date.now() - new Date(creeLe).getTime()) / 86_400_000));
  }
}

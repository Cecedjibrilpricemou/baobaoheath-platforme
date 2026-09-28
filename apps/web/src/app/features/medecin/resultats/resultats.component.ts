// features/medecin/resultats — les résultats d'analyse que ce médecin doit
// libérer au patient (addendum du 2026-09-28).
//
// Un résultat est écrit pour un soignant : « Hémoglobine 6 g/dL, hors bornes ».
// Le patient qui lisait cela seul ne savait pas s'il devait s'inquiéter. La
// visibilité est donc devenue un geste du médecin, auquel il peut joindre une
// explication en langage clair.
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import type { ResultatALibererView } from '@baobaoheath/shared-types';

import { MedecinService } from '../../../core/services/medecin.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { I18nService } from '../../../shared/services/i18n.service';

@Component({
  selector: 'app-medecin-resultats',
  standalone: true,
  imports: [DatePipe, FormsModule, RouterLink, TranslatePipe],
  templateUrl: './resultats.component.html',
  styleUrl: './resultats.component.scss',
})
export class ResultatsComponent implements OnInit {
  private service = inject(MedecinService);
  private toastr = inject(ToastrService);
  private i18n = inject(I18nService);

  resultats = signal<ResultatALibererView[]>([]);
  isLoading = signal(true);

  /** La demande dont le médecin est en train de rédiger l'explication. */
  ouverte = signal<string | null>(null);
  commentaire = '';
  enCours = signal<string | null>(null);

  /** Les critiques d'abord : ce sont ceux dont l'attente coûte le plus cher. */
  readonly critiques = computed(() => this.resultats().filter((r) => r.contientCritique));
  readonly ordinaires = computed(() => this.resultats().filter((r) => !r.contientCritique));

  ngOnInit() {
    this.charger();
  }

  private charger() {
    this.isLoading.set(true);
    this.service.getResultatsALiberer().subscribe({
      next: (res) => {
        this.resultats.set(res.data ?? []);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.toastr.error(
          this.i18n.t('MEDECIN.RESULTATS.ERR_LOAD'),
          this.i18n.t('COMMON.ERROR_TITLE')
        );
      },
    });
  }

  ouvrir(idDemande: string) {
    this.ouverte.set(this.ouverte() === idDemande ? null : idDemande);
    this.commentaire = '';
  }

  liberer(r: ResultatALibererView) {
    if (this.enCours()) return;
    this.enCours.set(r.idDemande);

    this.service.libererResultats(r.idDemande, this.commentaire.trim() || undefined).subscribe({
      next: () => {
        this.enCours.set(null);
        this.ouverte.set(null);
        this.commentaire = '';
        // Retirer la ligne plutôt que recharger : le médecin voit
        // immédiatement que son geste a été pris en compte.
        this.resultats.update((liste) => liste.filter((x) => x.idDemande !== r.idDemande));
        this.toastr.success(
          this.i18n.t('MEDECIN.RESULTATS.OK_LIBERE', { patient: `${r.patient.prenom} ${r.patient.nom}` })
        );
      },
      error: (err) => {
        this.enCours.set(null);
        this.toastr.error(
          err?.error?.error ?? err?.error?.message ?? this.i18n.t('MEDECIN.RESULTATS.ERR_LIBERER'),
          this.i18n.t('COMMON.ERROR_TITLE')
        );
        // Un autre médecin a pu libérer entre-temps : on se resynchronise.
        this.charger();
      },
    });
  }

  /** Depuis combien de jours le patient attend. */
  joursDAttente(valideeLe: string | Date): number {
    const ecart = Date.now() - new Date(valideeLe).getTime();
    return Math.max(0, Math.floor(ecart / 86_400_000));
  }
}

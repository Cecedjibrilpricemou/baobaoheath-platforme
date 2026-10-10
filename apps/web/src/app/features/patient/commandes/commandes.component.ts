// features/patient/commandes/commandes.component.ts
//
// Les commandes du patient, et le choix du mode de remise (P6 / EF-07).
//
// **Le retrait n'est pas un repli.** Beaucoup de patients habitent à côté
// d'une pharmacie et iront chercher eux-mêmes ; la livraison n'est jamais
// imposée. Les deux choix se présentent à égalité, et aucun n'est
// présélectionné.
//
// Le patient ne voyait rien jusqu'ici : l'appel partait, une pharmacie
// prenait la commande, et c'est à lui de dire comment être servi — sans
// qu'aucun écran ne le lui demande.
import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import type { CommandeView, ModeRemise } from '@baobaoheath/shared-types';
import { PatientService } from '../../../core/services/patient.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { I18nService } from '../../../shared/services/i18n.service';

@Component({
  selector: 'app-patient-commandes',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './commandes.component.html',
})
export class PatientCommandesComponent implements OnInit {
  private patient = inject(PatientService);
  private toastr = inject(ToastrService);
  private i18n = inject(I18nService);

  commandes = signal<CommandeView[]>([]);
  chargement = signal(true);
  enCours = signal<string | null>(null);

  /** Celles qu'une pharmacie a prises : c'est là qu'on choisit. */
  readonly prises = computed(() =>
    this.commandes().filter((c) => c.statut === 'PRISE_EN_CHARGE'));

  /** Celles qui cherchent encore une officine. */
  readonly enRecherche = computed(() =>
    this.commandes().filter((c) => c.statut === 'RECHERCHE_PHARMACIE'));

  /** Celles qu'aucune pharmacie du quartier n'a pu servir. */
  readonly sansPharmacie = computed(() =>
    this.commandes().filter((c) => c.statut === 'SANS_PHARMACIE'));

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    this.patient.mesCommandes().subscribe({
      next: (r) => {
        this.commandes.set(r.data ?? []);
        this.chargement.set(false);
      },
      error: () => {
        this.chargement.set(false);
        this.toastr.error(this.i18n.t('COMMON.ERROR_GENERIC'));
      },
    });
  }

  totalBoites(c: CommandeView): number {
    return c.lignes.reduce((t, l) => t + l.quantite, 0);
  }

  /**
   * Le dosage, sauf quand le libellé le porte déjà : le catalogue l'y met
   * souvent, et l'afficher à côté le répète.
   */
  dosageUtile(libelle: string, dosage?: string | null): string | null {
    if (!dosage) return null;
    return libelle.toLowerCase().includes(dosage.toLowerCase()) ? null : dosage;
  }

  choisir(c: CommandeView, mode: ModeRemise): void {
    if (this.enCours()) return;
    this.enCours.set(c.id);
    this.patient.choisirModeRemise(c.id, mode).subscribe({
      next: () => {
        this.enCours.set(null);
        this.toastr.success(this.i18n.t(`PATIENT.COMMANDES.CHOISI_${mode}`));
        this.charger();
      },
      error: (err) => {
        this.enCours.set(null);
        const e = err as { error?: { error?: string } };
        this.toastr.error(e?.error?.error ?? this.i18n.t('COMMON.ERROR_GENERIC'));
      },
    });
  }

  libelleMode(m: string | null | undefined): string {
    return m ? this.i18n.t(`PATIENT.COMMANDES.MODE_${m}`) : '';
  }
}

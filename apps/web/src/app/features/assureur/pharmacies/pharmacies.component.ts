// features/assureur/pharmacies/pharmacies.component.ts
//
// Le point 5.2 de l'addendum : « ce qui a été délivré, ce qui lui est facturé,
// ce qui est payé, ce qui reste dû, et les écarts ».
//
// **Un reste dû négatif s'affiche tel quel.** La compagnie a versé plus que dû :
// c'est un écart aussi, et le tronquer à zéro le rendrait introuvable.
import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ToastrService } from 'ngx-toastr';
import type { ReglementView, SituationPharmacieView } from '@baobaoheath/shared-types';
import { AssureurService } from '../../../core/services/assureur.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { I18nService } from '../../../shared/services/i18n.service';

@Component({
  selector: 'app-assureur-pharmacies',
  standalone: true,
  imports: [CommonModule, FormsModule, MatFormFieldModule, MatInputModule, TranslatePipe],
  templateUrl: './pharmacies.component.html',
})
export class AssureurPharmaciesComponent implements OnInit {
  private service = inject(AssureurService);
  private toastr = inject(ToastrService);
  private i18n = inject(I18nService);

  pharmacies = signal<SituationPharmacieView[]>([]);
  reglements = signal<ReglementView[]>([]);
  chargement = signal(true);
  enregistre = signal(false);

  /** L'officine qu'on règle, ou null quand la modale est fermée. */
  cible = signal<SituationPharmacieView | null>(null);

  versement = {
    montantGnf: null as number | null,
    periodeDebut: '',
    periodeFin: '',
    reference: '',
  };

  ngOnInit(): void {
    this.charger();
  }

  private charger(): void {
    this.chargement.set(true);
    this.service.mesPharmacies().subscribe({
      next: (r) => {
        this.pharmacies.set(r.data ?? []);
        this.chargement.set(false);
      },
      error: () => this.chargement.set(false),
    });
    this.service.mesReglements().subscribe({
      next: (r) => this.reglements.set(r.data ?? []),
      error: () => { /* l'historique est secondaire : son absence ne bloque rien */ },
    });
  }

  /**
   * Ouvre la saisie, pré-remplie du mois écoulé et du reste dû.
   *
   * C'est le geste courant : on règle le bordereau du mois précédent, pour le
   * montant qu'on doit. Les deux restent modifiables.
   */
  ouvrirVersement(p: SituationPharmacieView): void {
    const maintenant = new Date();
    const debut = new Date(maintenant.getFullYear(), maintenant.getMonth() - 1, 1);
    const fin = new Date(maintenant.getFullYear(), maintenant.getMonth(), 0);
    this.versement = {
      montantGnf: p.resteDuGnf > 0 ? p.resteDuGnf : null,
      periodeDebut: this.enDate(debut),
      periodeFin: this.enDate(fin),
      reference: '',
    };
    this.cible.set(p);
  }

  fermer(): void {
    this.cible.set(null);
  }

  peutEnregistrer(): boolean {
    const v = this.versement;
    return !this.enregistre()
      && !!this.cible()
      && !!v.montantGnf && v.montantGnf > 0
      && v.periodeDebut.length > 0
      && v.periodeFin.length > 0
      && v.periodeFin >= v.periodeDebut;
  }

  enregistrer(): void {
    const p = this.cible();
    if (!p || !this.peutEnregistrer()) return;
    this.enregistre.set(true);

    this.service.enregistrerReglement({
      idStructure: p.idStructure,
      montantGnf: Number(this.versement.montantGnf),
      periodeDebut: new Date(this.versement.periodeDebut).toISOString(),
      periodeFin: new Date(this.versement.periodeFin).toISOString(),
      ...(this.versement.reference.trim() ? { reference: this.versement.reference.trim() } : {}),
    }).subscribe({
      next: (r) => {
        this.enregistre.set(false);
        this.cible.set(null);
        this.toastr.success(r.message ?? this.i18n.t('ASSUREUR.VERSEMENT_FAIT'));
        this.charger();
      },
      error: (err) => {
        this.enregistre.set(false);
        const e = err as { error?: { error?: string } };
        this.toastr.error(e?.error?.error ?? this.i18n.t('COMMON.ERROR_GENERIC'));
      },
    });
  }

  montant(gnf: number): string {
    return new Intl.NumberFormat('fr-FR').format(gnf);
  }

  private enDate(d: Date): string {
    return d.toISOString().slice(0, 10);
  }
}

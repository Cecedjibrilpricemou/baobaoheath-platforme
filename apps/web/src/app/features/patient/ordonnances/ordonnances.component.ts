// features/patient/ordonnances — les ordonnances du patient, avec le couple
// numero + code que la pharmacie controle (EF-05-07/08) et le document
// imprimable (EF-06-02).
//
// Le code n'est pas affiche d'emblee : c'est le secret qui permet de retirer
// un traitement, et l'ecran s'ouvre souvent devant quelqu'un. Il se devoile
// d'un geste, au comptoir.
import { Component, OnInit, computed, inject, signal } from '@angular/core';
// NgTemplateOutlet est indispensable : sans lui, Angular ignore
// `*ngTemplateOutlet` en silence, le build reste vert et la page s'affiche
// vide.
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { ToastrService } from 'ngx-toastr';
import type { OrdonnanceView } from '@baobaoheath/shared-types';

import { OrdonnanceService } from '../../../core/services/ordonnance.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { I18nService } from '../../../shared/services/i18n.service';

@Component({
  selector: 'app-patient-ordonnances',
  standalone: true,
  imports: [DatePipe, NgTemplateOutlet, TranslatePipe],
  templateUrl: './ordonnances.component.html',
  styleUrl: './ordonnances.component.scss',
})
export class OrdonnancesComponent implements OnInit {
  private service = inject(OrdonnanceService);
  private toastr = inject(ToastrService);
  private i18n = inject(I18nService);

  ordonnances = signal<OrdonnanceView[]>([]);
  isLoading = signal(true);
  /** Identifiants des ordonnances dont le code est momentanement visible. */
  codesVisibles = signal<ReadonlySet<string>>(new Set());

  /** Celles qu'on peut encore presenter en pharmacie, mises en tete. */
  readonly actives = computed(() =>
    this.ordonnances().filter((o) => !o.expiree && o.statut !== 'SERVIE' && o.statut !== 'ANNULEE')
  );

  readonly archivees = computed(() =>
    this.ordonnances().filter((o) => o.expiree || o.statut === 'SERVIE' || o.statut === 'ANNULEE')
  );

  ngOnInit() {
    this.service.mesOrdonnances().subscribe({
      next: (res) => {
        this.ordonnances.set(res.data ?? []);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.toastr.error(this.i18n.t('PATIENT.ORDONNANCES.ERR_LOAD'), this.i18n.t('COMMON.ERROR_TITLE'));
      },
    });
  }

  codeVisible(id: string): boolean {
    return this.codesVisibles().has(id);
  }

  basculerCode(id: string) {
    this.codesVisibles.update((set) => {
      const suivant = new Set(set);
      if (suivant.has(id)) suivant.delete(id);
      else suivant.add(id);
      return suivant;
    });
  }

  /** Nombre de medicaments restant a retirer. */
  restantes(o: OrdonnanceView): number {
    return o.lignes.filter((l) => l.statut !== 'DELIVREE').length;
  }

  imprimer(o: OrdonnanceView) {
    window.open(this.service.urlDocument(o.id), '_blank', 'noopener');
  }
}

// features/assureur/tableau-de-bord/tableau-de-bord.component.ts
//
// Ce que la compagnie vient voir en arrivant : qui elle couvre, ce qu'elle
// doit, et sous quelles règles.
//
// **Les règles sont en lecture seule.** Elles se saisissent auprès de
// l'administration de la plateforme tant que l'échange conventionné (EF-09-02)
// n'existe pas : une compagnie qui modifierait elle-même son taux changerait
// ce qu'une pharmacie a déjà encaissé, sans que personne l'ait validé.
import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import type {
  CategorieProduit,
  MonAssureurView,
  SituationPharmacieView,
} from '@baobaoheath/shared-types';
import { AssureurService } from '../../../core/services/assureur.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { I18nService } from '../../../shared/services/i18n.service';

@Component({
  selector: 'app-assureur-tableau-de-bord',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './tableau-de-bord.component.html',
})
export class AssureurTableauDeBordComponent implements OnInit {
  private service = inject(AssureurService);
  private i18n = inject(I18nService);

  compagnie = signal<MonAssureurView | null>(null);
  pharmacies = signal<SituationPharmacieView[]>([]);
  chargement = signal(true);
  erreur = signal('');

  /** Les trois chiffres qui resument la dette, additionnes une seule fois. */
  readonly totaux = computed(() => {
    const p = this.pharmacies();
    const facture = p.reduce((s, x) => s + x.montantFactureGnf, 0);
    const paye = p.reduce((s, x) => s + x.montantPayeGnf, 0);
    return { facture, paye, reste: facture - paye, officines: p.length };
  });

  ngOnInit(): void {
    this.service.maCompagnie().subscribe({
      next: (r) => {
        this.compagnie.set(r.data ?? null);
        this.chargement.set(false);
      },
      error: (err) => {
        this.chargement.set(false);
        // Un compte mal rattache donne un message precis cote API : le
        // repeter evite de chercher du cote des droits.
        const e = err as { error?: { error?: string } };
        this.erreur.set(e?.error?.error ?? this.i18n.t('COMMON.ERROR_GENERIC'));
      },
    });

    this.service.mesPharmacies().subscribe({
      next: (r) => this.pharmacies.set(r.data ?? []),
      error: () => { /* le bandeau d'erreur de la compagnie suffit */ },
    });
  }

  /** 1 500 000 plutot que 1500000 : on compte les zeros autrement. */
  montant(gnf: number): string {
    return new Intl.NumberFormat('fr-FR').format(gnf);
  }

  libelleCategorie(c: CategorieProduit): string {
    return this.i18n.t(`ASSUREUR.CAT_${c}`);
  }

  libelleMode(m: string): string {
    return this.i18n.t(`ASSUREUR.MODE_${m}`);
  }
}

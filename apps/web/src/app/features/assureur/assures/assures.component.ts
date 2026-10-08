// features/assureur/assures/assures.component.ts
//
// Les personnes que la compagnie couvre, et ce qu'elle a pris en charge.
//
// **L'écran dit explicitement ce qu'il ne montre pas.** Un assureur qui ne voit
// aucun détail de délivrance pourrait croire à un oubli et le réclamer ; lui
// dire que c'est une règle, et pourquoi, vaut mieux qu'un silence.
import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import type { AssureView } from '@baobaoheath/shared-types';
import { AssureurService } from '../../../core/services/assureur.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { I18nService } from '../../../shared/services/i18n.service';

@Component({
  selector: 'app-assureur-assures',
  standalone: true,
  imports: [CommonModule, FormsModule, MatFormFieldModule, MatInputModule, TranslatePipe],
  templateUrl: './assures.component.html',
})
export class AssureurAssuresComponent implements OnInit {
  private service = inject(AssureurService);
  private i18n = inject(I18nService);

  assures = signal<AssureView[]>([]);
  chargement = signal(true);
  recherche = signal('');

  /**
   * Le filtre se fait ici et non au serveur : une compagnie compte ses assurés
   * par centaines, pas par millions, et une liste déjà chargée se filtre sans
   * aller-retour.
   */
  readonly visibles = computed(() => {
    const q = this.recherche().trim().toLowerCase();
    if (!q) return this.assures();
    return this.assures().filter((a) =>
      `${a.patient.prenom} ${a.patient.nom} ${a.numeroPolice}`.toLowerCase().includes(q));
  });

  ngOnInit(): void {
    this.service.mesAssures().subscribe({
      next: (r) => {
        this.assures.set(r.data ?? []);
        this.chargement.set(false);
      },
      error: () => this.chargement.set(false),
    });
  }

  montant(gnf: number): string {
    return new Intl.NumberFormat('fr-FR').format(gnf);
  }

  libelleStatut(s: string): string {
    return this.i18n.t(`ASSUREUR.STATUT_${s}`);
  }
}

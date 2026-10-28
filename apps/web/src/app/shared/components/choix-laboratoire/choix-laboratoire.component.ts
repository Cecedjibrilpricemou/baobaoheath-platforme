// Le choix du laboratoire, avec la couverture des examens cochés.
//
// **Le renvoi se faisait à l'aveugle.** La liste rendait tous les laboratoires
// actifs du pays, sans dire lesquels savaient faire les examens demandés : le
// laboratoire recevait la demande et découvrait qu'il ne la réalisait pas. Le
// patient, lui, s'était déplacé.
//
// Partagé par les deux écrans qui prescrivent — le dossier du médecin et le
// détail d'épisode de l'accueil. Les dupliquer aurait fait diverger la règle.
import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import type {
  ChoixLaboratoiresView,
  ExamenNonCouvertView,
  LaboratoireChoixView,
} from '@baobaoheath/shared-types';
import { HopitalService } from '../../../core/services/hopital.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

/** Ce que l'écran parent reçoit quand le médecin a choisi. */
export interface ChoixLaboratoire {
  id: string;
  nom: string;
  nonCouverts: ExamenNonCouvertView[];
}

@Component({
  selector: 'app-choix-laboratoire',
  standalone: true,
  imports: [CommonModule, MatIconModule, TranslatePipe],
  templateUrl: './choix-laboratoire.component.html',
  styleUrl: './choix-laboratoire.component.scss',
})
export class ChoixLaboratoireComponent {
  private readonly hopital = inject(HopitalService);

  /** Les examens cochés par le prescripteur. La couverture s'y rapporte. */
  readonly examens = input.required<string[]>();

  readonly choisi = output<ChoixLaboratoire | null>();

  readonly donnees = signal<ChoixLaboratoiresView | null>(null);
  readonly chargement = signal(false);
  readonly erreur = signal('');
  readonly toutLePays = signal(false);
  readonly idChoisi = signal<string | null>(null);

  /** Les trois groupes, dans l'ordre du parcours, les vides écartés. */
  readonly groupes = computed(() => {
    const d = this.donnees();
    if (!d) return [];
    return [
      { cle: 'INTERNE' as const, items: d.interne },
      { cle: 'CONSEILLE' as const, items: d.conseilles },
      { cle: 'AUTRE' as const, items: d.autres },
    ].filter((g) => g.items.length > 0);
  });

  constructor() {
    // La couverture se recalcule à chaque case cochée : le médecin voit la
    // situation **avant** de choisir, pas après le départ du patient.
    effect(() => {
      const ids = this.examens();
      const pays = this.toutLePays();
      this.charger(ids, pays);
    });
  }

  private charger(ids: string[], toutLePays: boolean): void {
    this.chargement.set(true);
    this.erreur.set('');
    this.hopital.choixLaboratoires(ids, toutLePays).subscribe({
      next: (r) => {
        this.chargement.set(false);
        this.donnees.set(r.data ?? null);
        // Un laboratoire choisi puis sorti de la liste — élargissement annulé,
        // examens changés — ne doit pas rester sélectionné en silence.
        const id = this.idChoisi();
        if (id && !this.trouver(id)) this.choisir(null);
      },
      error: (err: unknown) => {
        this.chargement.set(false);
        const e = err as { error?: { error?: string; message?: string } };
        this.erreur.set(e?.error?.error ?? e?.error?.message ?? 'COMMON.ERROR_GENERIC');
      },
    });
  }

  private trouver(id: string): LaboratoireChoixView | undefined {
    const d = this.donnees();
    if (!d) return undefined;
    return [...d.interne, ...d.conseilles, ...d.autres].find((l) => l.id === id);
  }

  choisir(id: string | null): void {
    this.idChoisi.set(id);
    const labo = id ? this.trouver(id) : undefined;
    this.choisi.emit(labo ? { id: labo.id, nom: labo.nom, nonCouverts: labo.nonCouverts } : null);
  }

  basculerPays(): void {
    this.toutLePays.update((v) => !v);
  }

  /** `3 sur 5`, ou rien tant qu'aucun examen n'est coché. */
  couverture(l: LaboratoireChoixView): string {
    if (l.demandes === 0) return '';
    return `${l.couverts}/${l.demandes}`;
  }

  complet(l: LaboratoireChoixView): boolean {
    return l.demandes === 0 || l.couverts === l.demandes;
  }

  manquants(l: LaboratoireChoixView): string {
    return l.nonCouverts.map((e) => e.libelle).join(', ');
  }
}

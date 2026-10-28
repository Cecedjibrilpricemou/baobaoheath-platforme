// features/laboratoire/plateau — ce que ce laboratoire realise.
//
// **Le renvoi se faisait a l'aveugle.** Le medecin voyait tous les
// laboratoires actifs du pays sans savoir lesquels savaient faire les examens
// qu'il prescrivait ; le laboratoire decouvrait la demande et devait la
// refuser. C'est ici que le laboratoire le dit une fois pour toutes.
//
// Le piege de cet ecran : **tant que rien n'est declare, tout est repute
// realisable.** Celui qui coche un seul examen croirait avoir ajoute alors
// qu'il aurait restreint les 32 autres. L'ecran le dit avant, pas apres.
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { ToastrService } from 'ngx-toastr';
import type { LignePlateauView } from '@baobaoheath/shared-types';

import { LaboratoireService } from '../../../core/services/laboratoire.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { I18nService } from '../../../shared/services/i18n.service';

@Component({
  selector: 'app-labo-plateau',
  standalone: true,
  imports: [FormsModule, MatButtonModule, TranslatePipe],
  templateUrl: './plateau.component.html',
  styleUrl: './plateau.component.scss',
})
export class LaboPlateauComponent implements OnInit {
  private labo   = inject(LaboratoireService);
  private toastr = inject(ToastrService);
  private i18n   = inject(I18nService);

  isLoading = signal(true);
  isSaving  = signal(false);
  nom       = signal('');
  nonDeclare = signal(false);
  lignes    = signal<LignePlateauView[]>([]);
  filtre    = signal('');

  /** 33 lignes a plat seraient illisibles : on garde les categories. */
  readonly groupes = computed(() => {
    const q = this.filtre().trim().toLowerCase();
    const liste = q
      ? this.lignes().filter((l) =>
          l.libelle.toLowerCase().includes(q) || l.codeLoinc.includes(q) || l.categorie.toLowerCase().includes(q))
      : this.lignes();
    const groupes = new Map<string, LignePlateauView[]>();
    for (const l of liste) groupes.set(l.categorie, [...(groupes.get(l.categorie) ?? []), l]);
    return [...groupes.entries()].map(([categorie, items]) => ({ categorie, items }));
  });

  readonly nbRealises = computed(() => this.lignes().filter((l) => l.realise).length);

  ngOnInit() { this.charger(); }

  private charger() {
    this.isLoading.set(true);
    this.labo.plateauTechnique().subscribe({
      next: (r) => {
        this.isLoading.set(false);
        this.nom.set(r.data?.nom ?? '');
        this.nonDeclare.set(r.data?.nonDeclare ?? false);
        this.lignes.set(r.data?.lignes ?? []);
      },
      error: (err) => { this.isLoading.set(false); this.erreur(err); },
    });
  }

  private erreur(err: unknown) {
    const e = err as { error?: { error?: string; message?: string } };
    this.toastr.error(
      e?.error?.error ?? e?.error?.message ?? this.i18n.t('COMMON.ERROR_GENERIC'),
      this.i18n.t('COMMON.ERROR_TITLE')
    );
  }

  // Modifier une ligne remplace le tableau : le signal ne verrait pas une
  // mutation en place.
  private majLigne(idExamen: string, champs: Partial<LignePlateauView>) {
    this.lignes.update((ls) => ls.map((l) => (l.idExamen === idExamen ? { ...l, ...champs } : l)));
  }

  basculer(l: LignePlateauView) {
    // Un examen qu'on ne realise plus n'a plus ni delai ni prix propre.
    this.majLigne(l.idExamen, l.realise
      ? { realise: false, delaiHeures: null, prixGnf: null }
      : { realise: true });
  }

  // La contrainte SQL refuse zero et le negatif : l'ecran les ramene a « non
  // renseigne » plutot que de laisser l'API renvoyer une erreur illisible.
  changerDelai(l: LignePlateauView, valeur: string) {
    const n = Number(valeur);
    this.majLigne(l.idExamen, { delaiHeures: valeur.trim() === '' || !Number.isFinite(n) || n <= 0 ? null : Math.trunc(n) });
  }

  changerPrix(l: LignePlateauView, valeur: string) {
    const n = Number(valeur);
    this.majLigne(l.idExamen, { prixGnf: valeur.trim() === '' || !Number.isFinite(n) || n <= 0 ? null : Math.trunc(n) });
  }

  toutCocher(realise: boolean) {
    this.lignes.update((ls) => ls.map((l) => (realise ? { ...l, realise: true } : { ...l, realise: false, delaiHeures: null, prixGnf: null })));
  }

  enregistrer() {
    if (this.isSaving()) return;
    this.isSaving.set(true);
    this.labo.declarerPlateau({
      examens: this.lignes().map((l) => ({
        idExamen: l.idExamen,
        realise: l.realise,
        delaiHeures: l.delaiHeures,
        prixGnf: l.prixGnf,
      })),
    }).subscribe({
      next: (r) => {
        this.isSaving.set(false);
        this.nonDeclare.set(r.data?.nonDeclare ?? false);
        this.lignes.set(r.data?.lignes ?? this.lignes());
        this.toastr.success(this.i18n.t('LABO.PLATEAU.ENREGISTRE'), this.i18n.t('COMMON.SUCCESS'));
      },
      error: (err) => { this.isSaving.set(false); this.erreur(err); },
    });
  }
}

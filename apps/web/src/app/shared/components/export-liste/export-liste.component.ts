// shared/components/export-liste/export-liste.component.ts
//
// Imprimer une liste, ou l'emporter dans un tableur.
//
// **Le document imprimé et le fichier viennent des mêmes lignes.** Un écran
// qui imprimerait sa mise en page et exporterait autre chose finirait par
// dire deux choses différentes du même jour — et c'est le genre d'écart qu'on
// ne découvre qu'en les comparant devant quelqu'un.
//
// **Ce qui est imprimé est ce qui est affiché**, filtres et recherche
// compris : on emporte la liste qu'on a sous les yeux, pas une autre tirée du
// serveur dans son dos.
//
// L'impression ne rejoue pas la mise en page de l'écran. Les cartes, les
// pastilles et les boutons s'impriment mal, et chaque écran a la sienne : le
// composant produit son propre tableau, pour que tous les documents sortis de
// la plateforme se ressemblent.
import { CommonModule } from '@angular/common';
import { Component, inject, input } from '@angular/core';
import { enCsv } from '@baobaoheath/shared-types';
import { AuthService } from '../../../core/services/auth.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { I18nService } from '../../services/i18n.service';

/** Une colonne du document : son titre, et comment la lire sur une ligne. */
export interface ColonneExport<T> {
  /**
   * Une clef de traduction, pas du texte.
   *
   * Chaque gabarit de la plateforme porte une bascule fr/en et `en.json` est
   * maintenu a parite : un titre en dur sortait le document en francais quelle
   * que soit la langue choisie. Les clefs vivent sous `EXPORT.COL.*`.
   */
  titre: string;
  /** La valeur brute. Une date part en ISO dans le CSV, formatée à l'écran. */
  valeur: (ligne: T) => string | number | Date | null | undefined;
  /** Aligner à droite : les montants et les quantités se comparent ainsi. */
  nombre?: boolean;
}

@Component({
  selector: 'app-export-liste',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './export-liste.component.html',
  styleUrl: './export-liste.component.scss',
})
export class ExportListeComponent<T> {
  private auth = inject(AuthService);
  private i18n = inject(I18nService);

  /** La clef du titre du document : `EXPORT.DOC.PRODUITS_A_COMMANDER`… */
  titre = input.required<string>();
  /**
   * La structure, la période, le filtre en cours : ce qui situe le document.
   *
   * Deja traduit par l'ecran, qui seul connait ses parametres. Une liste
   * filtree ou paginee doit le dire : une feuille partielle qui se tait se
   * fait passer pour l'ensemble.
   */
  sousTitre = input<string>('');
  colonnes = input.required<ColonneExport<T>[]>();
  lignes = input.required<readonly T[]>();
  /** Le nom du fichier, sans extension. À défaut, le titre suffit. */
  nomFichier = input<string>('');

  /** Le titre, dans la langue choisie. */
  titreTraduit(): string {
    return this.i18n.t(this.titre());
  }

  /** L'intitule d'une colonne, dans la langue choisie. */
  entete(colonne: ColonneExport<T>): string {
    return this.i18n.t(colonne.titre);
  }

  /** Qui a sorti ce document : une feuille anonyme ne s'explique pas. */
  editePar(): string {
    const u = this.auth.currentUser();
    return u ? `${u.prenom ?? ''} ${u.nom ?? ''}`.trim() : '';
  }

  editeLe(): Date {
    return new Date();
  }

  /** Affiché dans le tableau : une date lisible, un vide pour un trou. */
  cellule(ligne: T, colonne: ColonneExport<T>): string {
    const v = colonne.valeur(ligne);
    if (v === null || v === undefined || v === '') return '—';
    if (v instanceof Date) return v.toLocaleDateString('fr-FR');
    if (typeof v === 'number') return new Intl.NumberFormat('fr-FR').format(v);
    return String(v);
  }

  imprimer(): void {
    // `print()` suffit : la feuille de style d'impression masque tout le reste
    // de la page et ne laisse que ce document.
    window.print();
  }

  /**
   * Le fichier, fabriqué depuis les mêmes colonnes et les mêmes lignes.
   *
   * L'échappement vient de `@baobaoheath/shared-types` — point-virgule pour
   * Excel français, guillemets doublés, BOM sans lequel les accents se
   * cassent. Ces règles ont été apprises à la dure côté serveur ; les
   * réécrire ici les ferait diverger.
   */
  telecharger(): void {
    const cols = this.colonnes();
    const contenu = enCsv(
      cols.map((c) => this.entete(c)),
      this.lignes().map((l) => cols.map((c) => c.valeur(l))),
    );

    const nom = (this.nomFichier() || this.titreTraduit())
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const jour = new Date().toISOString().slice(0, 10);

    const lien = document.createElement('a');
    const url = URL.createObjectURL(new Blob([contenu], { type: 'text/csv;charset=utf-8;' }));
    lien.href = url;
    lien.download = `${nom}-${jour}.csv`;
    lien.click();
    // Sans cela l'objet reste en mémoire tant que l'onglet vit, et une page
    // de pharmacie reste ouverte toute la journée.
    URL.revokeObjectURL(url);
  }

  /** « 14 lignes », pour qu'on sache ce qu'on emporte avant de l'emporter. */
  libelleCompte(): string {
    return this.i18n.t('EXPORT.LIGNES', { n: this.lignes().length });
  }
}

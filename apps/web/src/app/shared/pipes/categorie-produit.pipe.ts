// shared/pipes/categorie-produit.pipe.ts
// Traduit la categorie fermee du catalogue (decision du 2026-10-01) en libelle
// lisible. Sans cela l'ecran affiche « LAIT_INFANTILE ».
//
// La categorie est une enumeration : une valeur inconnue signifie que le
// schema a bouge sans que le front suive. On rend alors la valeur brute plutot
// qu'une chaine vide, pour que l'ecart se voie.
import { Pipe, PipeTransform, inject } from '@angular/core';
import type { CategorieProduit } from '@baobaoheath/shared-types';
import { I18nService } from '../services/i18n.service';

@Pipe({ name: 'categorieProduit', standalone: true })
export class CategorieProduitPipe implements PipeTransform {
  private i18n = inject(I18nService);

  transform(categorie: CategorieProduit | string | null | undefined): string {
    if (!categorie) return '';
    const cle = `CATALOGUE.CATEGORIE.${categorie}`;
    const libelle = this.i18n.t(cle);
    return libelle === cle ? String(categorie) : libelle;
  }
}

// shared/pipes/quantite-unite.pipe.ts
// Affiche une quantité avec son unité, accentuée et accordée : « 60 boîtes »
// au lieu de « 60 boite ». L'unité est un texte libre en base ; seules les
// unités courantes sont traduites (UNITE.<CODE>.UN / PLUSIEURS), les autres
// sont rendues telles quelles pour ne rien inventer.
import { Pipe, PipeTransform, inject } from '@angular/core';
import { I18nService } from '../services/i18n.service';

const CONNUES = ['BOITE', 'UNITE', 'COMPRIME', 'FLACON', 'SACHET', 'AMPOULE', 'TUBE', 'PLAQUETTE'];

/** « Boîtes » -> « BOITE » : sans accents, sans pluriel, en majuscules. */
function code(unite: string): string {
  return unite.trim().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/s$/i, '').toUpperCase();
}

/** L'unité seule, accordée à la quantité : « boîtes ». */
export function formaterUnite(
  t: (cle: string) => string,
  quantite: number,
  unite: string | null | undefined,
): string {
  const brute = unite?.trim() || 'unite';
  const c = code(brute);
  if (!CONNUES.includes(c)) return brute;
  // Français : pluriel à partir de 2 (0 et 1 au singulier).
  // Anglais (UNITE.REGLE = "en") : pluriel dès que la quantité n'est pas 1.
  const pluriel = t('UNITE.REGLE') === 'en' ? Math.abs(quantite) !== 1 : Math.abs(quantite) >= 2;
  const forme = pluriel ? 'PLUSIEURS' : 'UN';
  return t(`UNITE.${c}.${forme}`);
}

export function formaterQuantite(
  t: (cle: string) => string,
  quantite: number,
  unite: string | null | undefined,
): string {
  return `${quantite} ${formaterUnite(t, quantite, unite)}`;
}

@Pipe({ name: 'quantiteUnite', standalone: true, pure: false })
export class QuantiteUnitePipe implements PipeTransform {
  private i18n = inject(I18nService);

  /** `seule` : n'affiche que l'unité (quand la quantité est affichée à part). */
  transform(quantite: number | null | undefined, unite: string | null | undefined, seule = false): string {
    if (quantite == null) return '';
    const t = (cle: string) => this.i18n.t(cle);
    return seule ? formaterUnite(t, quantite, unite) : formaterQuantite(t, quantite, unite);
  }
}

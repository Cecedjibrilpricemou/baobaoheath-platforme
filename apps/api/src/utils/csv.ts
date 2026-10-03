/**
 * Ecrire un CSV qu'Excel ouvre correctement.
 *
 * Le pendant de `analyserCsv` (import des referentiels, EF-12-03). Les memes
 * details font echouer un export reel, dans l'autre sens :
 *
 *   - **le separateur** : Excel en francais attend le point-virgule. Avec des
 *     virgules, il met toute la ligne dans la premiere colonne ;
 *   - **les guillemets** : un champ qui contient le separateur, un guillemet
 *     ou un saut de ligne doit etre entoure de guillemets, les guillemets
 *     interieurs etant doubles. L'export d'analytics joignait sur `,` sans
 *     rien echapper : un motif de consultation comme « Fievre, toux » decalait
 *     toutes les colonnes suivantes, en silence ;
 *   - **le BOM** : sans lui, Excel lit le fichier dans l'encodage de la
 *     machine et « Prefecture » devient « PrÃ©fecture ». C'est le meme BOM
 *     que l'import tolere a la lecture — ici on l'ecrit expres.
 */

/** Le separateur par defaut : celui qu'Excel en francais attend. */
export const SEPARATEUR_CSV = ';';

/** Le BOM UTF-8, sans lequel Excel se trompe d'encodage. */
export const BOM_UTF8 = '﻿';

/**
 * Un champ, echappe si besoin.
 *
 * `null` et `undefined` donnent une cellule vide — et non « null », qui
 * s'afficherait tel quel dans le tableur de l'operateur. Une date part en
 * ISO : c'est le seul format qu'Excel et un humain lisent tous les deux sans
 * ambiguite sur l'ordre jour/mois.
 */
export function champCsv(valeur: unknown, separateur = SEPARATEUR_CSV): string {
  if (valeur === null || valeur === undefined) return '';
  const texte = valeur instanceof Date ? valeur.toISOString() : String(valeur);
  if (texte === '') return '';

  const doitEtreEntoure =
    texte.includes(separateur) ||
    texte.includes('"') ||
    texte.includes('\n') ||
    texte.includes('\r') ||
    // Un espace de bord disparaitrait a la relecture : on le preserve.
    texte !== texte.trim();

  return doitEtreEntoure ? `"${texte.replace(/"/g, '""')}"` : texte;
}

/**
 * Le fichier complet : BOM, en-tetes, puis les lignes.
 *
 * Les fins de ligne sont des CRLF, ce qu'attend la specification du CSV et ce
 * qu'Excel sous Windows produit lui-meme.
 */
export function enCsv(
  entetes: string[],
  lignes: unknown[][],
  separateur = SEPARATEUR_CSV
): string {
  const toutes = [entetes, ...lignes].map((ligne) =>
    ligne.map((c) => champCsv(c, separateur)).join(separateur)
  );
  return BOM_UTF8 + toutes.join('\r\n') + '\r\n';
}

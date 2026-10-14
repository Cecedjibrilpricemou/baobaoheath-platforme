// Les clefs des documents imprimés existent, dans les deux langues.
//
// **Une clef absente s'imprime telle quelle.** Le service d'i18n rend la clef
// brute quand elle manque : un `titre` mal orthographié ne casse rien, ne
// lève rien, et sort sur le papier sous la forme `EXPORT.DOC.AGENDAA`. On ne
// le découvre qu'en imprimant, écran par écran, dans les deux langues.
//
// Ce test lit les sources plutôt que de monter les composants : les intitulés
// de colonnes vivent dans des tableaux `ColonneExport`, et le seul moyen de
// les atteindre tous sans instancier vingt-huit écrans est de les lire.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(process.cwd(), 'src');
const I18N = join(SRC, 'app', 'shared', 'i18n');

function fichiers(racine: string, extensions: string[]): string[] {
  const trouves: string[] = [];
  for (const entree of readdirSync(racine)) {
    const chemin = join(racine, entree);
    if (statSync(chemin).isDirectory()) trouves.push(...fichiers(chemin, extensions));
    else if (extensions.some((e) => entree.endsWith(e))) trouves.push(chemin);
  }
  return trouves;
}

/** Les clefs `EXPORT.*` citées quelque part dans les sources. */
function clefsCitees(): Map<string, string[]> {
  const parClef = new Map<string, string[]>();
  for (const chemin of fichiers(join(SRC, 'app'), ['.ts', '.html'])) {
    if (chemin.endsWith('.spec.ts')) continue;
    const contenu = readFileSync(chemin, 'utf8');
    for (const m of contenu.matchAll(/EXPORT\.(?:COL|DOC|SOUS)\.[A-Z0-9_]+/g)) {
      const ou = parClef.get(m[0]) ?? [];
      ou.push(chemin.slice(SRC.length + 1));
      parClef.set(m[0], ou);
    }
  }
  return parClef;
}

function valeur(table: Record<string, unknown>, clef: string): unknown {
  return clef.split('.').reduce<unknown>(
    (n, p) => (n && typeof n === 'object' ? (n as Record<string, unknown>)[p] : undefined),
    table,
  );
}

const LANGUES = ['fr', 'en'] as const;

describe('les clefs des documents imprimés', () => {
  const citees = clefsCitees();
  const tables = Object.fromEntries(
    LANGUES.map((l) => [l, JSON.parse(readFileSync(join(I18N, `${l}.json`), 'utf8'))]),
  ) as Record<string, Record<string, unknown>>;

  it('il y en a, sinon ce test ne prouve rien', () => {
    // Un test qui parcourt des sources et n'en trouve aucune passerait
    // tranquillement si l'arborescence changeait de place.
    expect(citees.size).toBeGreaterThan(100);
  });

  for (const langue of LANGUES) {
    it(`toutes existent en « ${langue} »`, () => {
      const manquantes: string[] = [];
      for (const [clef, ou] of citees) {
        const v = valeur(tables[langue]!, clef);
        if (typeof v !== 'string' || v.trim() === '') {
          manquantes.push(`${clef} (cité dans ${ou.join(', ')})`);
        }
      }
      expect(manquantes).toEqual([]);
    });
  }

  // Les deux fichiers sont maintenus à parité : une clef traduite d'un seul
  // côté est le début d'une divergence, et elle ne se voit qu'à l'usage.
  it('et le français et l’anglais portent exactement les mêmes', () => {
    for (const bloc of ['COL', 'DOC', 'SOUS']) {
      const fr = Object.keys((valeur(tables['fr']!, `EXPORT.${bloc}`) ?? {}) as object).sort();
      const en = Object.keys((valeur(tables['en']!, `EXPORT.${bloc}`) ?? {}) as object).sort();
      expect({ bloc, cles: en }).toEqual({ bloc, cles: fr });
    }
  });

  // Les paramètres d'un sous-titre — `{{page}}`, `{{filtre}}` — doivent se
  // retrouver dans la traduction, sinon la valeur disparaît du document.
  it('et les paramètres des sous-titres survivent à la traduction', () => {
    const fr = (valeur(tables['fr']!, 'EXPORT.SOUS') ?? {}) as Record<string, string>;
    const en = (valeur(tables['en']!, 'EXPORT.SOUS') ?? {}) as Record<string, string>;
    const parametres = (s: string) => [...s.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();
    for (const [clef, texte] of Object.entries(fr)) {
      expect({ clef, params: parametres(en[clef] ?? '') }).toEqual({
        clef,
        params: parametres(texte),
      });
    }
  });
});

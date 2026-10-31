import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * L'interface française ne doit pas afficher d'anglais ni de fautes d'accord
 * fabriquées par un gabarit, et les quantités passent par le pipe d'unité.
 */
const racine = join(process.cwd(), 'src', 'app');
const fr = JSON.parse(readFileSync(join(racine, 'shared', 'i18n', 'fr.json'), 'utf8'));

function valeurs(objet: unknown, prefixe = ''): [string, string][] {
  if (typeof objet === 'string') return [[prefixe, objet]];
  return Object.entries(objet as Record<string, unknown>).flatMap(([cle, v]) =>
    valeurs(v, prefixe ? `${prefixe}.${cle}` : cle),
  );
}

function fichiers(dossier: string, extension: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) return fichiers(chemin, extension);
    return chemin.endsWith(extension) ? [chemin] : [];
  });
}

describe('textes de l\'interface française', () => {
  it('aucun libellé anglais', () => {
    const fautifs = valeurs(fr)
      .filter(([, v]) => /\b(Dashboard|Analytics|Heatmap)\b|Made for|^Export(\.\.\.)?$/.test(v))
      .map(([c, v]) => `${c} = ${v}`);
    expect(fautifs).toEqual([]);
  });

  it('aucun participe accordé à l\'aveugle après {{objet}}', () => {
    const fautifs = valeurs(fr)
      .filter(([, v]) => /\{\{objet\}\}( a été)? (consulté|modifié)/.test(v))
      .map(([c, v]) => `${c} = ${v}`);
    expect(fautifs).toEqual([]);
  });

  it('les quantités ne collent plus l\'unité brute', () => {
    const brut = /\.quantite \}\}\s*\{\{ *[\w.]+\.unite *\}\}|unit: *[\w.]+\.unite\b/;
    const fautifs = fichiers(join(racine, 'features'), '.html')
      .filter((f) => brut.test(readFileSync(f, 'utf8')))
      .map((f) => f.slice(racine.length));
    expect(fautifs).toEqual([]);
  });
});

// Chaque dependance de production de l'API est-elle vraiment utilisee ?
//
// **Le constat (revue du 30/10).** `@anthropic-ai/sdk` figurait dans les
// dependances sans qu'aucun fichier ne l'importe : une dizaine de paquets
// transitifs installes dans l'image de production, et une surface d'attaque
// de plus pour rien. Ce test, ecrit pour lui, en a trouve deux autres :
// `uuid` (le code utilise `crypto.randomUUID`) et
// `@scalar/express-api-reference` (la documentation passe par
// swagger-ui-express). Il refuse qu'une dependance declaree ne soit importee
// nulle part.
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const api = join(__dirname, '..');
const paquet = JSON.parse(readFileSync(join(api, 'package.json'), 'utf8')) as { dependencies: Record<string, string> };

/**
 * Celles qu'aucun `import` ne nomme, et pourquoi elles restent.
 * Une entree ici doit dire qui s'en sert.
 */
const INDIRECTES: Record<string, string> = {
  '@prisma/client': 'importe par le client genere (src/config/generated), hors de ce parcours',
  '@types/multer': 'types de multer, lus par tsc a la compilation du build',
};

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    if (nom === 'generated' || nom === 'node_modules') return [];
    return statSync(chemin).isDirectory() ? fichiers(chemin) : /\.(ts|mts|cts|js)$/.test(nom) ? [chemin] : [];
  });
}

const sources = [...fichiers(join(api, 'src')), ...fichiers(join(api, 'prisma'))]
  .map((f) => readFileSync(f, 'utf8'))
  .join('\n');

describe('dependances de production de l API', () => {
  it.each(Object.keys(paquet.dependencies))('%s est importee quelque part (ou justifiee)', (nom) => {
    if (INDIRECTES[nom]) return;
    const echappe = nom.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
    // `from 'x'`, `require('x')`, `import('x')`, et l'import nu `import 'x'` (dotenv/config).
    const importee = new RegExp(`(from\\s+|require\\(|import\\(|import\\s+)['"]${echappe}(/[^'"]*)?['"]`).test(sources);
    expect(importee).toBe(true);
  });
});

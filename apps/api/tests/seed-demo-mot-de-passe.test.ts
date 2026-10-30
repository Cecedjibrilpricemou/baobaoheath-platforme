// Le mot de passe commun des comptes de demonstration.
//
// Il etait ecrit en clair dans `prisma/seed-demo.ts`, suivi par git, dans un
// depot public : douze comptes professionnels — pharmacien, medecin, admin
// national — ouvrables par quiconque lisait le fichier. Il vient desormais
// d'une variable d'environnement, **sans valeur par defaut** : une valeur par
// defaut ne ferait que deplacer le mot de passe connu d'une ligne.
import { readFileSync } from 'fs';
import { join } from 'path';
import { LONGUEUR_MIN_MOT_DE_PASSE_DEMO, lireMotDePasseDemo } from '../prisma/mot-de-passe-demo';

describe('lireMotDePasseDemo', () => {
  it('refuse de semer sans SEED_DEMO_PASSWORD', () => {
    expect(() => lireMotDePasseDemo({})).toThrow(/SEED_DEMO_PASSWORD/);
  });

  it('refuse une valeur vide', () => {
    expect(() => lireMotDePasseDemo({ SEED_DEMO_PASSWORD: '' })).toThrow(/SEED_DEMO_PASSWORD/);
  });

  it('refuse un mot de passe trop court', () => {
    const court = 'x'.repeat(LONGUEUR_MIN_MOT_DE_PASSE_DEMO - 1);
    expect(() => lireMotDePasseDemo({ SEED_DEMO_PASSWORD: court })).toThrow(/caracteres/);
  });

  it('rend la valeur fournie', () => {
    const valeur = 'une-phrase-de-passe-locale';
    expect(lireMotDePasseDemo({ SEED_DEMO_PASSWORD: valeur })).toBe(valeur);
  });
});

describe('prisma/seed-demo.ts', () => {
  const source = readFileSync(join(__dirname, '..', 'prisma', 'seed-demo.ts'), 'utf8');

  it('ne contient plus de mot de passe ecrit en dur', () => {
    expect(source).not.toMatch(/MOT_DE_PASSE\s*=\s*['"`]/);
  });

  it('lit le mot de passe par lireMotDePasseDemo', () => {
    expect(source).toMatch(/MOT_DE_PASSE\s*=\s*lireMotDePasseDemo\(\)/);
  });

  it("n'affiche jamais le mot de passe dans la console", () => {
    expect(source).not.toMatch(/console\.\w+\([^)]*\$\{MOT_DE_PASSE\}/);
  });
});

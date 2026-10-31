import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { formaterQuantite, formaterUnite } from './quantite-unite.pipe';

const dossier = join(process.cwd(), 'src', 'app', 'shared', 'i18n');
function traducteur(langue: string) {
  const dico = JSON.parse(readFileSync(join(dossier, `${langue}.json`), 'utf8'));
  return (cle: string) => {
    const v = cle.split('.').reduce<any>((o, k) => (o == null ? undefined : o[k]), dico);
    return typeof v === 'string' ? v : cle;
  };
}

describe('formaterQuantite', () => {
  const fr = traducteur('fr');
  const en = traducteur('en');

  it('accentue et accorde les unités connues', () => {
    expect(formaterQuantite(fr, 60, 'boite')).toBe('60 boîtes');
    expect(formaterQuantite(fr, 1, 'boite')).toBe('1 boîte');
    expect(formaterQuantite(fr, 0, 'Boites')).toBe('0 boîte');
    expect(formaterQuantite(fr, 3, 'unite')).toBe('3 unités');
    expect(formaterQuantite(fr, 2, 'comprimé')).toBe('2 comprimés');
    expect(formaterQuantite(fr, 2, 'flacons')).toBe('2 flacons');
  });

  it('suit la langue', () => {
    expect(formaterQuantite(en, 60, 'boite')).toBe('60 boxes');
    expect(formaterQuantite(en, 1, 'boite')).toBe('1 box');
    expect(formaterQuantite(en, 0, 'boite')).toBe('0 boxes');
  });

  it("donne l'unité seule, accordée", () => {
    expect(formaterUnite(fr, 12, 'unite')).toBe('unités');
    expect(formaterUnite(fr, 1, '')).toBe('unité');
    expect(formaterUnite(fr, 3, 'kit')).toBe('kit');
  });

  it('laisse une unité libre telle quelle', () => {
    expect(formaterQuantite(fr, 5, 'seringue 5 ml')).toBe('5 seringue 5 ml');
  });

  it("emploie l'unité par défaut quand elle est absente", () => {
    expect(formaterQuantite(fr, 4, '')).toBe('4 unités');
    expect(formaterQuantite(fr, 4, null)).toBe('4 unités');
  });
});

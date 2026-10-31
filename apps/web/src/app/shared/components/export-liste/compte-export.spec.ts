import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { libelleCompteExport } from './export-liste.component';

const app = join(process.cwd(), 'src', 'app');
const dico = (l: string) => JSON.parse(readFileSync(join(app, 'shared', 'i18n', `${l}.json`), 'utf8'));
function traducteur(langue: string) {
  const d = dico(langue);
  return (cle: string, p: Record<string, string | number> = {}) => {
    const v = cle.split('.').reduce<any>((o, k) => (o == null ? undefined : o[k]), d);
    return typeof v === 'string' ? v.replace(/\{\{(\w+)\}\}/g, (_, k) => String(p[k] ?? '')) : cle;
  };
}

describe("compte affiché par l'export", () => {
  const fr = traducteur('fr');

  it('dit que seule la page est emportée quand le total est plus grand', () => {
    expect(libelleCompteExport(fr, 50, 100)).toBe('50 ligne(s) de cette page, sur 100');
  });

  it('reste simple quand la page contient tout', () => {
    expect(libelleCompteExport(fr, 14, 14)).toBe('14 ligne(s)');
    expect(libelleCompteExport(fr, 14, null)).toBe('14 ligne(s)');
  });

  it('existe en anglais', () => {
    expect(libelleCompteExport(traducteur('en'), 50, 100)).toMatch(/50.*100/);
  });

  it('le journal et les comptes transmettent leur total', () => {
    for (const f of ['features/admin/journal/journal.component.html', 'features/admin/comptes/comptes.component.html']) {
      expect(readFileSync(join(app, f), 'utf8')).toMatch(/<app-export-liste[^>]*\[total\]="total\(\)"/s);
    }
  });
});

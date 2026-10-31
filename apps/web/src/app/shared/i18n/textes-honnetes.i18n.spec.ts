import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Les textes affichés ne doivent pas promettre ce que la plateforme ne fait pas :
 * - le QR patient n'est pas chiffré (c'est un identifiant opaque) ;
 * - le triage ASC est un moteur de règles, pas une intelligence artificielle.
 */
const dossier = join(process.cwd(), 'src', 'app', 'shared', 'i18n');
const lire = (langue: string) => JSON.parse(readFileSync(join(dossier, `${langue}.json`), 'utf8'));

const MOTS_IA = /\bIA\b|\bAI\b|Intelligen|Artifici|Smart/i;

function valeurs(objet: unknown, prefixe = ''): [string, string][] {
  if (typeof objet === 'string') return [[prefixe, objet]];
  return Object.entries(objet as Record<string, unknown>).flatMap(([cle, v]) =>
    valeurs(v, prefixe ? `${prefixe}.${cle}` : cle),
  );
}

describe('textes honnêtes (QR et triage)', () => {
  for (const langue of ['fr', 'en']) {
    const t = lire(langue);

    it(`${langue} : le triage n'est pas présenté comme une IA`, () => {
      const cibles = [
        ['ASC.NAV_TRIAGE', t.ASC.NAV_TRIAGE],
        ...valeurs(t.ASC.TRIAGE, 'ASC.TRIAGE'),
        ...valeurs(t.ADMIN.SETTINGS, 'ADMIN.SETTINGS').filter(([c]) => /\.(AI_|TAB_ALERTS)/.test(c)),
      ];
      const fautifs = cibles.filter(([, v]) => MOTS_IA.test(v)).map(([c, v]) => `${c} = ${v}`);
      expect(fautifs).toEqual([]);
    });

    it(`${langue} : un avertissement accompagne le triage`, () => {
      expect(typeof t.ASC.TRIAGE.AVERTISSEMENT).toBe('string');
      expect(t.ASC.TRIAGE.AVERTISSEMENT.length).toBeGreaterThan(20);
    });

    it(`${langue} : le QR ne prétend pas être chiffré`, () => {
      expect(t.PATIENT.QR.SECURITY_TEXT).not.toMatch(/chiffr|crypt/i);
    });
  }

  it('la page de triage affiche l\'avertissement', () => {
    const html = readFileSync(join(process.cwd(), 'src', 'app', 'features', 'asc', 'triage', 'triage.html'), 'utf8');
    expect(html).toContain('ASC.TRIAGE.AVERTISSEMENT');
  });

  it('le titre de route du triage passe par une clé de traduction', () => {
    const ts = readFileSync(
      join(process.cwd(), 'src', 'app', 'shared', 'components', 'asc-layout', 'asc-layout.component.ts'),
      'utf8',
    );
    expect(ts).toMatch(/'\/asc\/triage':\s*'ASC\.NAV_TRIAGE'/);
  });
});

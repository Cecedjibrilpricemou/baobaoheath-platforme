// Qui peut atteindre quoi.
//
// Les gardes de route n'etaient couvertes par aucun test : retirer un
// `requireRole` d'une route ne cassait rien, et l'API s'ouvrait en silence.
// `requireRole` porte desormais ses roles (`GardeDeRole.roles`), ce qui permet
// de parcourir la pile d'un routeur et d'affirmer le cablage reel.
//
// Ce fichier verrouille en particulier l'addendum du 2026-09-28, point 9 :
// l'agent d'accueil ne fait plus rien de medical — ni prescription, ni
// ordonnance, ni produit.
import type { Role } from '../src/config/generated/client/client';

// Ce fichier est le seul a importer de vrais routeurs : ils tirent
// `auth.middleware`, qui lit ces secrets au chargement du module. Les autres
// suites n'en ont pas besoin, d'ou l'absence de fichier de setup global.
process.env['JWT_SECRET'] ??= 'test-secret-au-moins-seize-caracteres';
process.env['JWT_REFRESH_SECRET'] ??= 'test-refresh-au-moins-seize-caracteres';
process.env['DB_ENCRYPTION_KEY'] ??= '0'.repeat(64);
process.env['DATABASE_URL'] ??= 'postgresql://test:test@127.0.0.1:5432/test';

// Ce fichier est le seul a importer de vrais routeurs : ils tirent
// `auth.middleware`, qui lit ces secrets au chargement du module. Les autres
// suites n'en ont pas besoin, d'ou l'absence de fichier de setup global.
process.env['JWT_SECRET'] ??= 'test-secret-au-moins-seize-caracteres';
process.env['JWT_REFRESH_SECRET'] ??= 'test-refresh-au-moins-seize-caracteres';
process.env['DB_ENCRYPTION_KEY'] ??= '0'.repeat(64);
process.env['DATABASE_URL'] ??= 'postgresql://test:test@127.0.0.1:5432/test';

jest.mock('../src/config/prisma', () => ({ prisma: {} }));
jest.mock('../src/config/redis', () => ({ getRedis: () => null }));

type Couche = {
  route?: { path: string; methods: Record<string, boolean>; stack: { handle: unknown }[] };
  handle?: unknown;
};

/** Les roles qui peuvent atteindre `methode chemin`, gardes du routeur comprises. */
function rolesPour(routeur: { stack: Couche[] }, methode: string, chemin: string): Role[] | null {
  const globales: Role[][] = [];
  for (const couche of routeur.stack) {
    // Une garde posee par `router.use(...)` s'applique a tout ce qui suit.
    if (!couche.route) {
      const r = (couche.handle as { roles?: readonly Role[] })?.roles;
      if (r) globales.push([...r]);
      continue;
    }
    if (couche.route.path !== chemin || !couche.route.methods[methode]) continue;

    const propres: Role[][] = [];
    for (const c of couche.route.stack) {
      const r = (c.handle as { roles?: readonly Role[] })?.roles;
      if (r) propres.push([...r]);
    }
    // L'intersection de toutes les gardes traversees : chacune doit passer.
    const toutes = [...globales, ...propres];
    if (!toutes.length) return [];
    return toutes.reduce((a, b) => a.filter((x) => b.includes(x)));
  }
  return null;
}

// Les routeurs s'importent apres les mocks.
/* eslint-disable @typescript-eslint/no-require-imports */
const hopital = require('../src/routes/hopital.routes').default as { stack: Couche[] };
const commande = require('../src/routes/commande.routes').default as { stack: Couche[] };
const resultats = require('../src/routes/resultats.routes').default as { stack: Couche[] };
const medecin = require('../src/routes/medecin.routes').default as { stack: Couche[] };

describe('l accueil ne fait plus rien de medical (addendum, point 9)', () => {
  // Chacune de ces routes lui etait ouverte avant le 2026-09-28.
  const INTERDITES: [string, string, string][] = [
    ['hopital', 'post', '/episodes/:id/demandes-analyse'],
    ['hopital', 'get', '/demandes-analyse/:id'],
    ['hopital', 'post', '/demandes-analyse/:id/annuler'],
    ['hopital', 'get', '/demandes-analyse/:id/document'],
    ['hopital', 'post', '/episodes/:id/cloturer'],
    ['commande', 'post', '/'],
  ];
  const ROUTEURS: Record<string, { stack: Couche[] }> = { hopital, commande, resultats };

  it.each(INTERDITES)('%s %s %s refuse AGENT_ACCUEIL', (nom, methode, chemin) => {
    const roles = rolesPour(ROUTEURS[nom]!, methode, chemin);
    expect(roles).not.toBeNull();
    expect(roles).not.toContain('AGENT_ACCUEIL');
  });

  it('la lecture des resultats lui est fermee', () => {
    // Garde posee au niveau du routeur : elle couvre toutes ses routes.
    const globales = resultats.stack
      .filter((c) => !c.route)
      .flatMap((c) => [...((c.handle as { roles?: readonly Role[] })?.roles ?? [])]);
    expect(globales.length).toBeGreaterThan(0);
    expect(globales).not.toContain('AGENT_ACCUEIL');
    expect(globales).toContain('MEDECIN');
  });
});

describe('ce que l accueil garde', () => {
  // Il cherche le patient, ouvre l'episode de la visite et redirige. Lui
  // retirer cela le laisserait sans moyen de pointer une arrivee.
  const GARDEES: [string, string][] = [
    ['get', '/patients/recherche'],
    ['post', '/episodes'],
    ['get', '/episodes'],
    ['post', '/episodes/:id/orientation'],
  ];

  it.each(GARDEES)('%s %s reste ouverte a AGENT_ACCUEIL', (methode, chemin) => {
    expect(rolesPour(hopital, methode, chemin)).toContain('AGENT_ACCUEIL');
  });
});

describe('ce qui revient au medecin', () => {
  it('prescrire une analyse lui est ouvert', () => {
    expect(rolesPour(hopital, 'post', '/episodes/:id/demandes-analyse')).toContain('MEDECIN');
  });

  it('cloturer l episode lui est ouvert', () => {
    expect(rolesPour(hopital, 'post', '/episodes/:id/cloturer')).toContain('MEDECIN');
  });

  // Liberer des resultats est un acte medical : ni l'administrateur de la
  // structure, qui atteint pourtant le reste du routeur, ni personne d'autre.
  it('liberer des resultats est reserve au seul MEDECIN', () => {
    expect(rolesPour(medecin, 'post', '/resultats/:id/liberer')).toEqual(['MEDECIN']);
    expect(rolesPour(medecin, 'get', '/resultats')).toEqual(['MEDECIN']);
  });

  // Addendum, point 3 : le creneau appartient au medecin. L'administrateur de
  // structure atteint le reste du routeur mais n'a pas d'agenda a tenir.
  it('fixer un rendez-vous et tenir son agenda sont reserves au MEDECIN', () => {
    expect(rolesPour(medecin, 'post', '/orientations/:idEpisode/rendez-vous')).toEqual(['MEDECIN']);
    expect(rolesPour(medecin, 'get', '/rendez-vous')).toEqual(['MEDECIN']);
    expect(rolesPour(medecin, 'patch', '/rendez-vous/:id/statut')).toEqual(['MEDECIN']);
  });
});

describe('le pointage de presence reste a l accueil (addendum, point 2)', () => {
  // C'est le seul geste de l'accueil sur un rendez-vous : il ne le cree pas et
  // n'en change pas l'heure. Le lui retirer le priverait de son metier.
  it.each([
    ['get', '/presences'],
    ['post', '/rendez-vous/:id/presence'],
  ])('%s %s reste ouverte a AGENT_ACCUEIL', (methode, chemin) => {
    expect(rolesPour(hopital, methode, chemin)).toContain('AGENT_ACCUEIL');
  });

  // Mais il ne doit pas pouvoir creer de rendez-vous par cette porte.
  it('l accueil n a aucune route de creation de rendez-vous', () => {
    const cheminsRdv = hopital.stack
      .filter((c) => c.route?.path.includes('rendez-vous'))
      .map((c) => `${Object.keys(c.route!.methods)[0]} ${c.route!.path}`);
    expect(cheminsRdv).toEqual(['post /rendez-vous/:id/presence']);
  });
});

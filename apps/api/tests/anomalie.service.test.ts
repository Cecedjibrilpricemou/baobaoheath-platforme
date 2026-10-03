// Detection d'anomalies d'acces (EF-12-06).
//
// Ce service rend des **signaux a examiner, pas des verdicts**. Un soignant de
// garde consulte beaucoup de dossiers la nuit sans rien faire de mal ; un
// comptoir de pharmacie scanne des dizaines de codes par jour. Un detecteur
// qui trancherait ferait suspendre des gens a tort — et une suspension coupe
// un soignant de ses patients.
//
// D'ou le soin mis sur `evaluer`, qui est pure : c'est elle qui decide ce
// qu'un administrateur verra.

jest.mock('../src/config/prisma', () => ({
  prisma: {
    journalAudit: { groupBy: jest.fn(), findMany: jest.fn() },
    utilisateur: { findMany: jest.fn() },
  },
}));
jest.mock('../src/config/redis', () => ({ getRedis: () => null }));

type M = jest.Mock;
const { prisma } = jest.requireMock('../src/config/prisma') as {
  prisma: { journalAudit: { groupBy: M; findMany: M }; utilisateur: { findMany: M } };
};

import { detecter, evaluer, SEUILS_PAR_DEFAUT } from '../src/services/anomalie.service';

const SEUILS = SEUILS_PAR_DEFAUT;
const MAINTENANT = new Date('2026-10-03T12:00:00.000Z');
const RIEN = { idUtilisateur: 'u1', refus: 0, dossiers: 0, adresses: 1 };

beforeEach(() => {
  jest.resetAllMocks();
  prisma.journalAudit.groupBy.mockResolvedValue([]);
  prisma.journalAudit.findMany.mockResolvedValue([]);
  prisma.utilisateur.findMany.mockResolvedValue([]);
});

// ── La decision, eprouvee sans base ──────────────────────────────────

describe('evaluer : ce qui ne declenche rien', () => {
  it('une activite ordinaire ne produit aucun signal', () => {
    expect(evaluer(RIEN, SEUILS)).toEqual([]);
  });

  // Le seuil est atteint, pas depasse : le signal doit sortir. L'erreur
  // inverse — un `>` au lieu d'un `>=` — passerait inapercue.
  it.each([
    ['un refus sous le seuil', 0, { ...RIEN, refus: SEUILS.refusRepetes - 1 }],
    ['un refus au seuil exact', 1, { ...RIEN, refus: SEUILS.refusRepetes }],
    ['un volume sous le seuil', 0, { ...RIEN, dossiers: SEUILS.dossiersDistincts - 1 }],
    ['un volume au seuil exact', 1, { ...RIEN, dossiers: SEUILS.dossiersDistincts }],
  ])('%s produit %i signal(s)', (_nom, attendu, mesure) => {
    expect(evaluer(mesure, SEUILS)).toHaveLength(attendu);
  });
});

describe('evaluer : les trois signaux', () => {
  it('reconnait des refus repetes', () => {
    const [s] = evaluer({ ...RIEN, refus: 6 }, SEUILS);
    expect(s).toMatchObject({ type: 'REFUS_REPETES', mesure: 6, seuil: SEUILS.refusRepetes });
  });

  it('reconnait un volume inhabituel de dossiers', () => {
    const [s] = evaluer({ ...RIEN, dossiers: 40 }, SEUILS);
    expect(s).toMatchObject({ type: 'VOLUME_DOSSIERS', mesure: 40 });
  });

  it('reconnait un compte vu depuis plusieurs adresses', () => {
    const [s] = evaluer({ ...RIEN, adresses: 3 }, SEUILS);
    expect(s).toMatchObject({ type: 'ADRESSES_MULTIPLES', mesure: 3 });
  });

  it('cumule les signaux d un meme compte', () => {
    const types = evaluer({ idUtilisateur: 'u1', refus: 9, dossiers: 50, adresses: 4 }, SEUILS)
      .map((s) => s.type);
    expect(types).toEqual(['REFUS_REPETES', 'VOLUME_DOSSIERS', 'ADRESSES_MULTIPLES']);
  });
});

// ── Le rang ──────────────────────────────────────────────────────────

describe('evaluer : signal ou alerte', () => {
  // Un compte a six refus et un compte a soixante n'appellent pas la meme
  // reaction.
  it.each([
    [SEUILS.refusRepetes, 'SIGNAL'],
    [SEUILS.refusRepetes * 3 - 1, 'SIGNAL'],
    [SEUILS.refusRepetes * 3, 'ALERTE'],
    [SEUILS.refusRepetes * 10, 'ALERTE'],
  ])('%i refus -> %s', (refus, attendu) => {
    expect(evaluer({ ...RIEN, refus }, SEUILS)[0]?.gravite).toBe(attendu);
  });

  // Celui-la ne monte jamais : un soignant qui passe du wifi de
  // l'etablissement a son telephone le declenche. C'est un point de depart
  // d'enquete, pas un motif de suspension.
  it.each([2, 5, 20])('%i adresses reste un simple signal', (adresses) => {
    expect(evaluer({ ...RIEN, adresses }, SEUILS)[0]?.gravite).toBe('SIGNAL');
  });
});

// ── Les seuils sont des points de depart ─────────────────────────────

describe('les seuils par defaut', () => {
  // Ils ne sont pas calibres sur du trafic reel. Ce test ne les valide pas —
  // il les fixe, pour qu'un changement soit un choix et non un glissement.
  it('valent ce que le service annonce', () => {
    expect(SEUILS_PAR_DEFAUT).toEqual({
      refusRepetes: 5,
      dossiersDistincts: 30,
      adressesDistinctes: 2,
      fenetreHeures: 1,
    });
  });

  // Le volume est volontairement haut : un comptoir de pharmacie un jour de
  // forte affluence depasse vingt dossiers sans rien faire d'anormal.
  it('laissent passer une journee chargee de pharmacie', () => {
    expect(evaluer({ ...RIEN, dossiers: 25 }, SEUILS)).toEqual([]);
  });

  it('se laissent remplacer, seuil par seuil', () => {
    const stricts = { ...SEUILS, dossiersDistincts: 10 };
    expect(evaluer({ ...RIEN, dossiers: 25 }, stricts)).toHaveLength(1);
  });
});

// ── La detection complete ────────────────────────────────────────────

describe('detecter', () => {
  const lignes = (idUtilisateur: string, n: number, prefixe = 'p') =>
    Array.from({ length: n }, (_, i) => ({
      idUtilisateur, idPatientConcerne: `${prefixe}${i}`, ipAdresse: '10.0.0.1',
    }));

  it('ne rend rien quand rien ne depasse', async () => {
    prisma.journalAudit.findMany.mockResolvedValue(lignes('u1', 3));
    const r = await detecter(SEUILS, MAINTENANT);
    expect(r.anomalies).toEqual([]);
  });

  // Inutile de charger des comptes qui ne declenchent rien.
  it('ne nomme aucun acteur quand il n y a rien a signaler', async () => {
    prisma.journalAudit.findMany.mockResolvedValue(lignes('u1', 3));
    await detecter(SEUILS, MAINTENANT);
    expect(prisma.utilisateur.findMany).not.toHaveBeenCalled();
  });

  it('calcule la fenetre depuis maintenant', async () => {
    await detecter({ ...SEUILS, fenetreHeures: 2 }, MAINTENANT);
    const [args] = prisma.journalAudit.findMany.mock.calls[0] as [{ where: { creeLe: { gte: Date } } }];
    expect(args.where.creeLe.gte.toISOString()).toBe('2026-10-03T10:00:00.000Z');
  });

  it('compte les dossiers distincts, pas les lignes', async () => {
    // Quarante lignes, mais dix patients : un soignant qui ouvre dix fois le
    // meme dossier ne consulte pas quarante dossiers.
    const repetees = Array.from({ length: 40 }, (_, i) => ({
      idUtilisateur: 'u1', idPatientConcerne: `p${i % 10}`, ipAdresse: '10.0.0.1',
    }));
    prisma.journalAudit.findMany.mockResolvedValue(repetees);
    const r = await detecter(SEUILS, MAINTENANT);
    expect(r.anomalies).toEqual([]);
  });

  it('nomme l acteur et dit s il est encore actif', async () => {
    prisma.journalAudit.findMany.mockResolvedValue(lignes('u1', 35));
    prisma.utilisateur.findMany.mockResolvedValue([
      { id: 'u1', prenom: 'David', nom: 'Camara', role: 'MEDECIN', estActif: true },
    ]);
    const r = await detecter(SEUILS, MAINTENANT);
    expect(r.anomalies[0]).toMatchObject({
      type: 'VOLUME_DOSSIERS', acteur: 'David Camara', role: 'MEDECIN', acteurActif: true,
    });
  });

  // Le journal survit a la suppression d'un compte : la vue ne doit pas
  // tomber pour autant.
  it('supporte un acteur dont le compte a disparu', async () => {
    prisma.journalAudit.findMany.mockResolvedValue(lignes('fantome', 35));
    prisma.utilisateur.findMany.mockResolvedValue([]);
    const r = await detecter(SEUILS, MAINTENANT);
    expect(r.anomalies[0]).toMatchObject({ acteur: 'Compte supprime', role: null, acteurActif: false });
  });

  it('remonte les refus depuis leur agregat', async () => {
    prisma.journalAudit.findMany.mockResolvedValue(lignes('u1', 2));
    prisma.journalAudit.groupBy.mockResolvedValue([{ idUtilisateur: 'u1', _count: { _all: 8 } }]);
    prisma.utilisateur.findMany.mockResolvedValue([
      { id: 'u1', prenom: 'A', nom: 'B', role: 'MEDECIN', estActif: true },
    ]);
    const r = await detecter(SEUILS, MAINTENANT);
    expect(r.anomalies[0]).toMatchObject({ type: 'REFUS_REPETES', mesure: 8 });
  });

  // Un 400 est une requete mal formee, pas une porte forcee : la base de
  // demonstration en portait 58, tous issus de scripts de verification.
  it('ne compte que les refus d acces, 401 et 403', async () => {
    await detecter(SEUILS, MAINTENANT);
    const [args] = prisma.journalAudit.groupBy.mock.calls[0] as [
      { where: { statutHttp: { in: number[] } } }
    ];
    expect(args.where.statutHttp.in).toEqual([401, 403]);
  });

  it('met les alertes en tete, puis le depassement le plus net', async () => {
    prisma.journalAudit.findMany.mockResolvedValue([
      ...lignes('faible', 31, 'a'),
      ...lignes('fort', 95, 'b'),
    ]);
    prisma.utilisateur.findMany.mockResolvedValue([
      { id: 'faible', prenom: 'F', nom: 'Un', role: 'MEDECIN', estActif: true },
      { id: 'fort', prenom: 'G', nom: 'Deux', role: 'MEDECIN', estActif: true },
    ]);
    const r = await detecter(SEUILS, MAINTENANT);
    expect(r.anomalies.map((a) => a.gravite)).toEqual(['ALERTE', 'SIGNAL']);
    expect(r.anomalies[0]?.idUtilisateur).toBe('fort');
  });

  // Le jeu precedent ne prouvait rien : l alerte y avait aussi le plus gros
  // rapport, donc trier par rapport seul donnait le meme ordre. Un sabotage
  // du tri par gravite passait inapercu. Ici les deux regles se contredisent
  // — l adresse multiple a un rapport de 10 mais reste un simple signal,
  // l alerte un rapport de 3 — et seule la bonne regle donne cet ordre.
  it('fait passer une alerte devant un signal au rapport plus eleve', async () => {
    prisma.journalAudit.findMany.mockResolvedValue(
      Array.from({ length: 20 }, (_, i) => ({
        idUtilisateur: 'nomade', idPatientConcerne: null, ipAdresse: `10.0.0.${i}`,
      }))
    );
    prisma.journalAudit.groupBy.mockResolvedValue([
      { idUtilisateur: 'force', _count: { _all: SEUILS.refusRepetes * 3 } },
    ]);
    prisma.utilisateur.findMany.mockResolvedValue([
      { id: 'nomade', prenom: 'N', nom: 'Un', role: 'MEDECIN', estActif: true },
      { id: 'force', prenom: 'F', nom: 'Deux', role: 'MEDECIN', estActif: true },
    ]);
    const r = await detecter(SEUILS, MAINTENANT);
    expect(r.anomalies.map((a) => [a.type, a.gravite])).toEqual([
      ['REFUS_REPETES', 'ALERTE'],
      ['ADRESSES_MULTIPLES', 'SIGNAL'],
    ]);
    // Et la preuve que le rapport, seul, aurait inverse l ordre.
    const rapports = r.anomalies.map((a) => a.mesure / a.seuil);
    expect(rapports[1]).toBeGreaterThan(rapports[0]!);
  });

  it('rend les seuils employes, pour que l ecran puisse les montrer', async () => {
    const r = await detecter(SEUILS, MAINTENANT);
    expect(r.seuils).toEqual(SEUILS);
    expect(r.depuis).toBe('2026-10-03T11:00:00.000Z');
  });
});

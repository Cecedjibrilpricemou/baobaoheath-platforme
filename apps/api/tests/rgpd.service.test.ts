// Les demandes d'exercice de droits (EF-12-09).
//
// Ce service enregistre, fait suivre, et oblige a repondre par ecrit. Il
// **n'execute rien automatiquement** : un effacement de dossier de soins se
// decide, il ne se declenche pas.
//
// Le projet a paye l'absence de ce cadre : 15 comptes de la base de
// demonstration ont vu leur telephone remplace par « purged-<id> » le
// 2026-08-04, sans trace ni dans le journal ni dans le code — et a moitie
// seulement, nom et prenom etant restes lisibles.
import { ForbiddenError, NotFoundError, ValidationError } from '../src/utils/app-error';

jest.mock('../src/config/prisma', () => ({
  prisma: {
    patientProfile: { findUnique: jest.fn() },
    demandeRgpd: {
      findFirst: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(), create: jest.fn(), updateMany: jest.fn(),
    },
  },
}));
jest.mock('../src/config/redis', () => ({ getRedis: () => null }));

type M = jest.Mock;
const { prisma } = jest.requireMock('../src/config/prisma') as {
  prisma: {
    patientProfile: { findUnique: M };
    demandeRgpd: {
      findFirst: M; findMany: M; findUnique: M; findUniqueOrThrow: M; create: M; updateMany: M;
    };
  };
};

import {
  DELAI_JOURS, deposer, file, joursRestants, mesDemandes, prendreEnCharge, repondre,
} from '../src/services/rgpd.service';

const MAINTENANT = new Date('2026-10-03T12:00:00.000Z');
const REPONSE = "Dossier anonymise comme demande, le dossier de soins etant conserve pour sa duree legale.";

const LIGNE = {
  id: 'd1',
  type: 'EFFACEMENT',
  statut: 'RECUE',
  precision: null,
  dateLimite: new Date('2026-11-02T12:00:00.000Z'),
  reponse: null,
  traiteLe: null,
  creeLe: new Date('2026-10-03T12:00:00.000Z'),
  patient: { utilisateur: { prenom: 'Maomou', nom: 'Conde' } },
  traitePar: null,
};

beforeEach(() => {
  jest.resetAllMocks();
  prisma.patientProfile.findUnique.mockResolvedValue({ id: 'p1' });
  prisma.demandeRgpd.findFirst.mockResolvedValue(null);
  prisma.demandeRgpd.findMany.mockResolvedValue([]);
  prisma.demandeRgpd.create.mockResolvedValue(LIGNE);
  prisma.demandeRgpd.updateMany.mockResolvedValue({ count: 1 });
  prisma.demandeRgpd.findUniqueOrThrow.mockResolvedValue(LIGNE);
});

// ── Le delai ─────────────────────────────────────────────────────────

describe('joursRestants', () => {
  it.each([
    ['dans trente jours', '2026-11-02T12:00:00.000Z', 30],
    ['demain', '2026-10-04T12:00:00.000Z', 1],
    ["aujourd'hui", '2026-10-03T12:00:00.000Z', 0],
    ['hier, donc en retard', '2026-10-02T12:00:00.000Z', -1],
  ])('%s -> %i', (_nom, limite, attendu) => {
    expect(joursRestants(new Date(limite), MAINTENANT)).toBe(attendu);
  });
});

// ── Deposer ──────────────────────────────────────────────────────────

describe('deposer', () => {
  it('pose le delai a la creation, et non a la lecture', async () => {
    await deposer('u1', 'ACCES', undefined, MAINTENANT);
    const [args] = prisma.demandeRgpd.create.mock.calls[0] as [{ data: { dateLimite: Date } }];
    expect(args.data.dateLimite.toISOString()).toBe('2026-11-02T12:00:00.000Z');
  });

  // Une regle de delai qui changerait ne doit pas deplacer retroactivement
  // l'echeance de demandes deja recues.
  it('applique le delai annonce', () => {
    expect(DELAI_JOURS).toBe(30);
  });

  // Sans precision, l'administration ne sait pas quoi corriger et devra
  // rappeler le patient. Autant le lui dire tout de suite.
  it.each(['', '   ', 'faux'])('refuse une rectification precisee par « %s »', async (precision) => {
    await expect(deposer('u1', 'RECTIFICATION', precision, MAINTENANT)).rejects.toThrow(ValidationError);
  });

  it('accepte une rectification suffisamment precisee', async () => {
    await expect(
      deposer('u1', 'RECTIFICATION', 'Mon nom est mal orthographie : Conde et non Konde', MAINTENANT)
    ).resolves.toBeDefined();
  });

  it.each(['ACCES', 'EFFACEMENT', 'PORTABILITE', 'OPPOSITION', 'LIMITATION'] as const)(
    'accepte une demande de type %s sans precision',
    async (type) => {
      await expect(deposer('u1', type, undefined, MAINTENANT)).resolves.toBeDefined();
    }
  );

  // Deux demandes du meme type n'apportent rien et brouillent la file.
  it('refuse une seconde demande du meme type encore ouverte', async () => {
    prisma.demandeRgpd.findFirst.mockResolvedValue({ id: 'deja' });
    await expect(deposer('u1', 'ACCES', undefined, MAINTENANT)).rejects.toThrow(/deja en cours/);
  });

  it('ne regarde que les demandes ouvertes pour ce doublon', async () => {
    await deposer('u1', 'ACCES', undefined, MAINTENANT);
    const [args] = prisma.demandeRgpd.findFirst.mock.calls[0] as [{ where: Record<string, unknown> }];
    expect(args.where).toMatchObject({ statut: { in: ['RECUE', 'EN_COURS'] } });
  });

  it('refuse un utilisateur sans profil patient', async () => {
    prisma.patientProfile.findUnique.mockResolvedValue(null);
    await expect(deposer('u1', 'ACCES', undefined, MAINTENANT)).rejects.toThrow(NotFoundError);
  });
});

// ── La vue ───────────────────────────────────────────────────────────

describe('la vue d une demande', () => {
  it('compte les jours restants tant qu elle est ouverte', async () => {
    prisma.demandeRgpd.findMany.mockResolvedValue([LIGNE]);
    const [d] = await mesDemandes('u1', MAINTENANT);
    expect(d).toMatchObject({ joursRestants: 30, enRetard: false });
  });

  it('signale une demande en retard', async () => {
    prisma.demandeRgpd.findMany.mockResolvedValue([
      { ...LIGNE, dateLimite: new Date('2026-09-20T12:00:00.000Z') },
    ]);
    const [d] = await mesDemandes('u1', MAINTENANT);
    expect(d).toMatchObject({ enRetard: true });
    expect(d?.joursRestants).toBeLessThan(0);
  });

  // Afficher « -3 jours » sur une demande deja traitee donnerait une urgence
  // qui n'existe plus.
  it.each(['SATISFAITE', 'REFUSEE'])('ne compte plus les jours d une demande %s', async (statut) => {
    prisma.demandeRgpd.findMany.mockResolvedValue([
      { ...LIGNE, statut, dateLimite: new Date('2026-09-20T12:00:00.000Z'), reponse: REPONSE, traiteLe: MAINTENANT },
    ]);
    const [d] = await mesDemandes('u1', MAINTENANT);
    expect(d).toMatchObject({ joursRestants: null, enRetard: false });
  });

  it('nomme le demandeur et celui qui a traite', async () => {
    prisma.demandeRgpd.findMany.mockResolvedValue([
      { ...LIGNE, traitePar: { prenom: 'Cece', nom: 'Pricemou' } },
    ]);
    const [d] = await mesDemandes('u1', MAINTENANT);
    expect(d).toMatchObject({ demandeur: 'Maomou Conde', traitePar: 'Cece Pricemou' });
  });

  // L'agent peut avoir quitte la plateforme : sa decision reste.
  it('supporte un agent disparu', async () => {
    prisma.demandeRgpd.findMany.mockResolvedValue([{ ...LIGNE, traitePar: null }]);
    const [d] = await mesDemandes('u1', MAINTENANT);
    expect(d?.traitePar).toBeNull();
  });
});

// ── La file de l'administration ──────────────────────────────────────

describe('file', () => {
  it('met les ouvertes d abord, puis la plus urgente', async () => {
    await file({}, MAINTENANT);
    const [args] = prisma.demandeRgpd.findMany.mock.calls[0] as [{ orderBy: unknown }];
    expect(args.orderBy).toEqual([{ statut: 'asc' }, { dateLimite: 'asc' }]);
  });

  it('compte les ouvertes et les retards', async () => {
    prisma.demandeRgpd.findMany.mockResolvedValue([
      LIGNE,
      { ...LIGNE, id: 'd2', statut: 'EN_COURS', dateLimite: new Date('2026-09-01T12:00:00.000Z') },
      { ...LIGNE, id: 'd3', statut: 'SATISFAITE', reponse: REPONSE, traiteLe: MAINTENANT },
    ]);
    const f = await file({}, MAINTENANT);
    expect(f).toMatchObject({ ouvertes: 2, enRetard: 1, delaiJours: DELAI_JOURS });
  });

  it('filtre par statut et par type', async () => {
    await file({ statut: 'RECUE', type: 'EFFACEMENT' }, MAINTENANT);
    const [args] = prisma.demandeRgpd.findMany.mock.calls[0] as [{ where: Record<string, unknown> }];
    expect(args.where).toEqual({ statut: 'RECUE', type: 'EFFACEMENT' });
  });
});

// ── La prise en charge ───────────────────────────────────────────────

describe('prendreEnCharge', () => {
  // Deux agents ne doivent pas se croire chacun en charge de la meme demande.
  it('ne reclame qu une demande encore au statut RECUE', async () => {
    await prendreEnCharge('agent', 'd1', MAINTENANT);
    const [args] = prisma.demandeRgpd.updateMany.mock.calls[0] as [{ where: Record<string, unknown> }];
    expect(args.where).toEqual({ id: 'd1', statut: 'RECUE' });
  });

  it('refuse si quelqu un est passe avant', async () => {
    prisma.demandeRgpd.updateMany.mockResolvedValue({ count: 0 });
    prisma.demandeRgpd.findUnique.mockResolvedValue({ statut: 'EN_COURS' });
    await expect(prendreEnCharge('agent', 'd1', MAINTENANT)).rejects.toThrow(ForbiddenError);
  });

  // Distinguer « deja prise » de « n'existe pas » : ce n'est pas la meme
  // chose pour celui qui cherche.
  it('dit « introuvable » quand la demande n existe pas', async () => {
    prisma.demandeRgpd.updateMany.mockResolvedValue({ count: 0 });
    prisma.demandeRgpd.findUnique.mockResolvedValue(null);
    await expect(prendreEnCharge('agent', 'inconnue', MAINTENANT)).rejects.toThrow(NotFoundError);
  });
});

// ── La reponse ───────────────────────────────────────────────────────

describe('repondre', () => {
  // Un refus qu'on ne motive pas n'est pas contestable, et une demande
  // satisfaite doit dire ce qui a ete fait. La contrainte SQL l'exige aussi.
  it.each(['', '  ', 'non', 'ok', 'refuse'])('refuse la reponse « %s »', async (reponse) => {
    await expect(repondre('agent', 'd1', false, reponse, MAINTENANT)).rejects.toThrow(ValidationError);
  });

  it('dit pourquoi une reponse courte est refusee', async () => {
    await expect(repondre('agent', 'd1', false, 'non', MAINTENANT)).rejects.toThrow(/contestable/);
  });

  it('ne touche a rien quand la reponse est refusee', async () => {
    await expect(repondre('agent', 'd1', true, 'ok', MAINTENANT)).rejects.toThrow();
    expect(prisma.demandeRgpd.updateMany).not.toHaveBeenCalled();
  });

  it.each([
    [true, 'SATISFAITE'],
    [false, 'REFUSEE'],
  ])('satisfaite=%s -> %s', async (satisfaite, attendu) => {
    await repondre('agent', 'd1', satisfaite, REPONSE, MAINTENANT);
    const [args] = prisma.demandeRgpd.updateMany.mock.calls[0] as [{ data: Record<string, unknown> }];
    expect(args.data).toMatchObject({ statut: attendu, reponse: REPONSE, idTraitePar: 'agent' });
    expect(args.data['traiteLe']).toBe(MAINTENANT);
  });

  it('nettoie les espaces de bord de la reponse', async () => {
    await repondre('agent', 'd1', true, `   ${REPONSE}   `, MAINTENANT);
    const [args] = prisma.demandeRgpd.updateMany.mock.calls[0] as [{ data: { reponse: string } }];
    expect(args.data.reponse).toBe(REPONSE);
  });

  it('ne close qu une demande encore ouverte', async () => {
    await repondre('agent', 'd1', true, REPONSE, MAINTENANT);
    const [args] = prisma.demandeRgpd.updateMany.mock.calls[0] as [{ where: Record<string, unknown> }];
    expect(args.where).toEqual({ id: 'd1', statut: { in: ['RECUE', 'EN_COURS'] } });
  });

  it('refuse de repondre deux fois', async () => {
    prisma.demandeRgpd.updateMany.mockResolvedValue({ count: 0 });
    prisma.demandeRgpd.findUnique.mockResolvedValue({ statut: 'SATISFAITE' });
    await expect(repondre('agent', 'd1', true, REPONSE, MAINTENANT)).rejects.toThrow(/deja close/);
  });
});

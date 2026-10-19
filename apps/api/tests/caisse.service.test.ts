import {
  cloturerSession,
  ouvrirSession,
  rapportCaisse,
  sessionCourante,
} from '../src/services/caisse.service';
import type { JwtPayload } from '../src/types/auth.types';
import { ConflictError, ForbiddenError, ValidationError } from '../src/utils/app-error';

jest.mock('../src/config/prisma', () => {
  const prisma: Record<string, unknown> = {
    utilisateur: { findUnique: jest.fn(), findMany: jest.fn() },
    pharmacienProfile: { findUnique: jest.fn() },
    sessionCaisse: {
      findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(),
      updateMany: jest.fn(), findUniqueOrThrow: jest.fn(),
    },
    venteComptoir: { groupBy: jest.fn() },
  };
  prisma['$transaction'] = jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(prisma));
  return { prisma };
});

type M = jest.Mock;
const { prisma } = jest.requireMock('../src/config/prisma') as {
  prisma: {
    utilisateur: { findUnique: M; findMany: M };
    pharmacienProfile: { findUnique: M };
    sessionCaisse: {
      findFirst: M; findMany: M; create: M; updateMany: M; findUniqueOrThrow: M;
    };
    venteComptoir: { groupBy: M };
    $transaction: M;
  };
};

const titulaire: JwtPayload = { userId: 'owner-1', role: 'PHARMACIEN', sessionId: 'auth-1' } as JwtPayload;
const session = {
  id: 'caisse-1',
  statut: 'OUVERTE',
  montantOuvertureGnf: 50_000,
  montantEspecesEncaisseGnf: null,
  montantTheoriqueGnf: null,
  montantCompteGnf: null,
  ecartGnf: null,
  motifEcart: null,
  ouverteLe: new Date('2026-10-19T08:00:00Z'),
  clotureeLe: null,
  idStructure: 'pharmacie-1',
  idUtilisateur: 'owner-1',
  utilisateur: { id: 'owner-1', prenom: 'Awa', nom: 'Diallo' },
};

beforeEach(() => {
  jest.resetAllMocks();
  prisma.$transaction.mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn(prisma));
  prisma.utilisateur.findUnique.mockResolvedValue({
    idStructure: 'pharmacie-1',
    structure: { type: 'PHARMACIE' },
    pharmacienProfile: { roleOfficine: 'TITULAIRE' },
  });
  prisma.pharmacienProfile.findUnique.mockResolvedValue({ roleOfficine: 'TITULAIRE' });
  prisma.venteComptoir.groupBy.mockResolvedValue([]);
  prisma.sessionCaisse.updateMany.mockResolvedValue({ count: 1 });
});

describe('sessions de caisse', () => {
  it('ouvre une session rattachee au compte et a son officine', async () => {
    prisma.sessionCaisse.findFirst.mockResolvedValue(null);
    prisma.sessionCaisse.create.mockResolvedValue(session);

    const result = await ouvrirSession(titulaire, { montantOuvertureGnf: 50_000 });

    expect(prisma.sessionCaisse.create).toHaveBeenCalledWith(expect.objectContaining({
      data: {
        idStructure: 'pharmacie-1',
        idUtilisateur: 'owner-1',
        montantOuvertureGnf: 50_000,
      },
    }));
    expect(result.montantTheoriqueGnf).toBe(50_000);
  });

  it('ne permet pas deux sessions ouvertes pour le meme utilisateur', async () => {
    prisma.sessionCaisse.findFirst.mockResolvedValue({ id: 'caisse-1' });

    await expect(ouvrirSession(titulaire, { montantOuvertureGnf: 0 }))
      .rejects.toBeInstanceOf(ConflictError);
    expect(prisma.sessionCaisse.create).not.toHaveBeenCalled();
  });

  it('retourne uniquement la session de caisse du vendeur courant', async () => {
    prisma.sessionCaisse.findMany.mockResolvedValue([session]);

    const result = await sessionCourante(titulaire);

    expect(prisma.sessionCaisse.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ idStructure: 'pharmacie-1', idUtilisateur: 'owner-1' }),
      take: 1,
    }));
    expect(result?.utilisateur.id).toBe('owner-1');
  });

  it('fige le montant attendu et l ecart a la cloture', async () => {
    prisma.sessionCaisse.findFirst.mockResolvedValue(session);
    prisma.venteComptoir.groupBy
      .mockResolvedValueOnce([
        { statut: 'PAYEE', modePaiement: 'ESPECES', _sum: { montantPatientGnf: 35_000 }, _count: 1 },
        { statut: 'PAYEE', modePaiement: 'ORANGE_MONEY', _sum: { montantPatientGnf: 20_000 }, _count: 1 },
        { statut: 'EN_ATTENTE', modePaiement: 'MTN_MOMO', _sum: { montantPatientGnf: 0 }, _count: 1 },
        { statut: 'ANNULEE', modePaiement: 'ESPECES', _sum: { montantPatientGnf: 50 }, _count: 1 },
      ])
      .mockResolvedValueOnce([]);
    prisma.sessionCaisse.findUniqueOrThrow.mockResolvedValue({
      ...session,
      statut: 'CLOTUREE',
      montantEspecesEncaisseGnf: 35_000,
      montantOrangeMoneyGnf: 20_000,
      montantMtnMomoGnf: 0,
      montantTheoriqueGnf: 85_000,
      montantCompteGnf: 84_000,
      ecartGnf: -1_000,
      motifEcart: 'Ecart compte',
      nombreVentesPayees: 2,
      nombreVentesEnAttente: 1,
      nombreVentesAnnulees: 1,
      clotureeLe: new Date('2026-10-19T18:00:00Z'),
    });

    const result = await cloturerSession(titulaire, 'caisse-1', {
      montantCompteGnf: 84_000,
      motifEcart: 'Ecart compte',
    });

    expect(prisma.sessionCaisse.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { id: 'caisse-1', statut: 'OUVERTE' },
      data: expect.objectContaining({
        statut: 'CLOTUREE',
        montantEspecesEncaisseGnf: 35_000,
        montantOrangeMoneyGnf: 20_000,
        nombreVentesPayees: 2,
        nombreVentesEnAttente: 1,
        nombreVentesAnnulees: 1,
        montantTheoriqueGnf: 85_000,
        montantCompteGnf: 84_000,
        ecartGnf: -1_000,
      }),
    }));
    expect(result.ecartGnf).toBe(-1_000);
  });

  it('exige une justification et ne cloture pas en presence d un ecart non motive', async () => {
    prisma.sessionCaisse.findFirst.mockResolvedValue(session);
    prisma.venteComptoir.groupBy.mockResolvedValue([{
      statut: 'PAYEE', modePaiement: 'ESPECES',
      _sum: { montantPatientGnf: 100 }, _count: 1,
    }]);

    await expect(cloturerSession(titulaire, 'caisse-1', { montantCompteGnf: 200 }))
      .rejects.toBeInstanceOf(ValidationError);
    expect(prisma.sessionCaisse.updateMany).toHaveBeenCalledTimes(1);
  });

  it('refuse la cloture d une session appartenant a un autre compte', async () => {
    prisma.pharmacienProfile.findUnique.mockResolvedValue({ roleOfficine: 'CAISSIER' });
    prisma.sessionCaisse.findFirst.mockResolvedValue(null);

    await expect(cloturerSession(titulaire, 'autre-caisse', { montantCompteGnf: 0 }))
      .rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe('rapport financier de caisse', () => {
  it('filtre les ventes et sessions d un operateur sur son compte', async () => {
    prisma.sessionCaisse.findMany.mockResolvedValue([]);
    prisma.venteComptoir.groupBy.mockResolvedValue([]);
    prisma.pharmacienProfile.findUnique.mockResolvedValue({ roleOfficine: 'CAISSIER' });

    await rapportCaisse(titulaire, 'MOIS', '2026-10-15');

    expect(prisma.venteComptoir.groupBy).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ idStructure: 'pharmacie-1', idVendeur: 'owner-1' }),
    }));
    expect(prisma.sessionCaisse.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ idStructure: 'pharmacie-1', idUtilisateur: 'owner-1' }),
    }));
  });
});

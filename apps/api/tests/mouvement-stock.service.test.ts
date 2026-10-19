import { ajusterLotStock, listerMouvementsStock } from '../src/services/mouvement-stock.service';
import { ConflictError, ForbiddenError, NotFoundError } from '../src/utils/app-error';
import type { JwtPayload } from '../src/types/auth.types';

jest.mock('../src/config/prisma', () => {
  const prisma: Record<string, unknown> = {
    utilisateur: { findUnique: jest.fn() },
    lotStock: { findFirst: jest.fn(), updateMany: jest.fn() },
    stock: { updateMany: jest.fn() },
    mouvementStock: { findMany: jest.fn(), create: jest.fn() },
  };
  prisma['$transaction'] = jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(prisma));
  return { prisma };
});

const { prisma } = jest.requireMock('../src/config/prisma') as {
  prisma: {
    utilisateur: { findUnique: jest.Mock };
    lotStock: { findFirst: jest.Mock; updateMany: jest.Mock };
    stock: { updateMany: jest.Mock };
    mouvementStock: { findMany: jest.Mock; create: jest.Mock };
    $transaction: jest.Mock;
  };
};

const utilisateur = { userId: 'ph-u', role: 'PHARMACIEN', sessionId: 's' } as JwtPayload;
const lot = {
  id: 'lot-1',
  quantite: 10,
  idStock: 'stock-1',
  stock: { idStructure: 'officine-1', idMedicament: 'med-1' },
};

beforeEach(() => {
  jest.resetAllMocks();
  prisma.$transaction.mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn(prisma));
  prisma.utilisateur.findUnique.mockResolvedValue({ idStructure: 'officine-1' });
  prisma.lotStock.findFirst.mockResolvedValue(lot);
  prisma.lotStock.updateMany.mockResolvedValue({ count: 1 });
  prisma.stock.updateMany.mockResolvedValue({ count: 1 });
  prisma.mouvementStock.create.mockResolvedValue({ id: 'movement-1' });
});

describe('ajusterLotStock', () => {
  it('applique une hausse par lot et enregistre une variation positive atomiquement', async () => {
    const result = await ajusterLotStock(utilisateur, 'lot-1', 13, 'Reception manquante');

    expect(prisma.lotStock.updateMany).toHaveBeenCalledWith({
      where: { id: 'lot-1', quantite: 10 },
      data: { quantite: 13 },
    });
    expect(prisma.stock.updateMany).toHaveBeenCalledWith({
      where: { id: 'stock-1' },
      data: { quantite: { increment: 3 } },
    });
    expect(prisma.mouvementStock.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'AJUSTEMENT',
        quantite: 3,
        reference: 'lot-1',
        motif: 'Reception manquante',
        idStructure: 'officine-1',
        idMedicament: 'med-1',
        idStock: 'stock-1',
        idLot: 'lot-1',
        idUtilisateur: 'ph-u',
      }),
      select: { id: true },
    });
    expect(result).toEqual({
      idLot: 'lot-1',
      quantiteAvant: 10,
      quantiteComptee: 13,
      variation: 3,
      idMouvement: 'movement-1',
    });
  });

  it('enregistre une baisse par lot et empeche un stock total negatif', async () => {
    await ajusterLotStock(utilisateur, 'lot-1', 4, 'Casse constatee');

    expect(prisma.stock.updateMany).toHaveBeenCalledWith({
      where: { id: 'stock-1', quantite: { gte: 6 } },
      data: { quantite: { increment: -6 } },
    });
    expect(prisma.mouvementStock.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ type: 'AJUSTEMENT', quantite: -6 }),
    }));
  });

  it('ne cree pas de mouvement quand le comptage correspond deja au stock', async () => {
    const result = await ajusterLotStock(utilisateur, 'lot-1', 10, 'Comptage confirme');

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.mouvementStock.create).not.toHaveBeenCalled();
    expect(result.variation).toBe(0);
    expect(result.idMouvement).toBeNull();
  });

  it('refuse un lot hors de l officine', async () => {
    prisma.lotStock.findFirst.mockResolvedValue(null);
    await expect(ajusterLotStock(utilisateur, 'lot-other', 5, 'Casse constatee'))
      .rejects.toBeInstanceOf(NotFoundError);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('refuse une concurrence sur le comptage et annule la transaction', async () => {
    prisma.lotStock.updateMany.mockResolvedValue({ count: 0 });
    await expect(ajusterLotStock(utilisateur, 'lot-1', 12, 'Comptage confirme'))
      .rejects.toBeInstanceOf(ConflictError);
    expect(prisma.stock.updateMany).not.toHaveBeenCalled();
    expect(prisma.mouvementStock.create).not.toHaveBeenCalled();
  });

  it('refuse une baisse incoherente avec le total en stock', async () => {
    prisma.stock.updateMany.mockResolvedValue({ count: 0 });
    await expect(ajusterLotStock(utilisateur, 'lot-1', 4, 'Casse constatee'))
      .rejects.toBeInstanceOf(ConflictError);
    expect(prisma.mouvementStock.create).not.toHaveBeenCalled();
  });

  it('refuse une structure non rattachee', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue({ idStructure: null });
    await expect(ajusterLotStock(utilisateur, 'lot-1', 5, 'Casse constatee'))
      .rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe('listerMouvementsStock', () => {
  it('ne lit que les mouvements de l officine et borne la limite', async () => {
    prisma.mouvementStock.findMany.mockResolvedValue([]);

    await listerMouvementsStock('ph-u', 500);

    expect(prisma.mouvementStock.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { idStructure: 'officine-1' },
      take: 200,
      orderBy: [{ creeLe: 'desc' }, { id: 'desc' }],
    }));
  });
});

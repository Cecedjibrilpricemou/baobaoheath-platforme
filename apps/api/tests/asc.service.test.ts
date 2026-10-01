// Stocks du poste ASC : un ASC ne voit et ne modifie que ses lignes ; une
// ligne par medicament ; l'alerte est derivee du seuil.
import { createStock, getAscStocks, updateStock } from '../src/services/asc.service';
import { ConflictError, ForbiddenError, NotFoundError } from '../src/utils/app-error';

jest.mock('../src/config/prisma', () => {
  const prisma: Record<string, unknown> = {
    ascProfile: { findUnique: jest.fn() },
    medicament: { findUnique: jest.fn() },
    // Le stock se detaille en lots depuis le 2026-09-30 : la date de
    // peremption y descend, et la creation d'une ligne en pose un.
    lotStock: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    stock: {
      findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn(),
      // Reference de colonne utilisee par le filtre quantite <= seuilAlerte.
      fields: { seuilAlerte: { __field: 'seuilAlerte' } },
    },
  };
  prisma['$transaction'] = jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(prisma));
  return { prisma };
});

const { prisma } = jest.requireMock('../src/config/prisma') as {
  prisma: {
    ascProfile: { findUnique: jest.Mock };
    medicament: { findUnique: jest.Mock };
    lotStock: { findFirst: jest.Mock; create: jest.Mock; update: jest.Mock };
    stock: { findUnique: jest.Mock; findMany: jest.Mock; count: jest.Mock; create: jest.Mock; update: jest.Mock; fields: unknown };
    $transaction: jest.Mock;
  };
};

const ASC = { id: 'asc-1', idUtilisateur: 'asc-u' };

afterEach(() => jest.resetAllMocks());
beforeEach(() => {
  prisma.$transaction.mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn(prisma));
});

describe('getAscStocks', () => {
  beforeEach(() => prisma.ascProfile.findUnique.mockResolvedValue(ASC));

  it('marque enAlerte les lignes dont la quantite est au seuil ou en dessous, et les compte', async () => {
    prisma.stock.findMany.mockResolvedValue([
      { id: 's1', quantite: 5, seuilAlerte: 10, lots: [] },
      { id: 's2', quantite: 10, seuilAlerte: 10, lots: [] },
      { id: 's3', quantite: 40, seuilAlerte: 10, lots: [] },
    ]);
    prisma.stock.count.mockResolvedValue(3);

    const res = await getAscStocks('asc-u', {});

    expect(res.data.map(s => s.enAlerte)).toEqual([true, true, false]);
    expect(res.meta.alertes).toBe(2);
    expect(res.meta).toEqual(expect.objectContaining({ total: 3, page: 1, limit: 20, totalPages: 1 }));
  });

  // `Stock.datePeremption` a disparu le 2026-09-30 : l'ecran lisait un champ
  // que l'API n'envoyait plus, et n'affichait donc aucune date sans que rien
  // ne le signale. C'est la plus proche parmi les lots qui compte, puisque
  // c'est elle qui sortira la premiere.
  it('rend la peremption la plus proche parmi les lots encore en stock', async () => {
    const dans30 = new Date('2026-11-01T00:00:00.000Z');
    const dans300 = new Date('2027-07-01T00:00:00.000Z');
    prisma.stock.findMany.mockResolvedValue([
      { id: 's1', quantite: 60, seuilAlerte: 10, lots: [
        { quantite: 40, datePeremption: dans300 },
        { quantite: 20, datePeremption: dans30 },
      ] },
      // Un lot epuise ne sortira jamais : sa date ne doit pas etre retenue.
      { id: 's2', quantite: 40, seuilAlerte: 10, lots: [
        { quantite: 0, datePeremption: dans30 },
        { quantite: 40, datePeremption: dans300 },
      ] },
      // Sans lot date, il n'y a rien a afficher.
      { id: 's3', quantite: 10, seuilAlerte: 10, lots: [{ quantite: 10, datePeremption: null }] },
    ]);
    prisma.stock.count.mockResolvedValue(3);

    const res = await getAscStocks('asc-u', {});

    expect(res.data.map(s => s.peremptionLaPlusProche)).toEqual([
      dans30.toISOString(),
      dans300.toISOString(),
      null,
    ]);
  });

  it('demande bien les lots : sans eux la date ne peut pas etre calculee', async () => {
    prisma.stock.findMany.mockResolvedValue([]);
    prisma.stock.count.mockResolvedValue(0);

    await getAscStocks('asc-u', {});

    const [args] = prisma.stock.findMany.mock.calls[0] as [{ include: Record<string, unknown> }];
    expect(args.include).toHaveProperty('lots');
  });

  it('applique le filtre seuilAlerte aux deux requetes (liste et total)', async () => {
    prisma.stock.findMany.mockResolvedValue([]);
    prisma.stock.count.mockResolvedValue(0);

    await getAscStocks('asc-u', { seuilAlerte: true });

    const attendu = { idAsc: 'asc-1', quantite: { lte: prisma.stock.fields && (prisma.stock.fields as { seuilAlerte: unknown }).seuilAlerte } };
    expect(prisma.stock.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: attendu }));
    expect(prisma.stock.count).toHaveBeenCalledWith({ where: attendu });
  });

  it('ne liste que les lignes de l ASC connecte', async () => {
    prisma.stock.findMany.mockResolvedValue([]);
    prisma.stock.count.mockResolvedValue(0);

    await getAscStocks('asc-u', { page: 2, limit: 5 });

    expect(prisma.stock.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { idAsc: 'asc-1' }, skip: 5, take: 5 }));
  });
});

describe('createStock', () => {
  it('404 sans profil ASC', async () => {
    prisma.ascProfile.findUnique.mockResolvedValue(null);
    await expect(createStock('u-x', { idMedicament: 'm-1', quantite: 10, unite: 'boite' })).rejects.toBeInstanceOf(NotFoundError);
  });

  it('404 sur un medicament inconnu', async () => {
    prisma.ascProfile.findUnique.mockResolvedValue(ASC);
    prisma.medicament.findUnique.mockResolvedValue(null);
    await expect(createStock('asc-u', { idMedicament: 'm-x', quantite: 10, unite: 'boite' })).rejects.toBeInstanceOf(NotFoundError);
  });

  it('refuse une seconde ligne pour le meme medicament (409)', async () => {
    prisma.ascProfile.findUnique.mockResolvedValue(ASC);
    prisma.medicament.findUnique.mockResolvedValue({ id: 'm-1' });
    prisma.stock.findUnique.mockResolvedValue({ id: 's-existant' });

    await expect(createStock('asc-u', { idMedicament: 'm-1', quantite: 10, unite: 'boite' })).rejects.toBeInstanceOf(ConflictError);
    expect(prisma.stock.findUnique).toHaveBeenCalledWith({ where: { idAsc_idMedicament: { idAsc: 'asc-1', idMedicament: 'm-1' } } });
    expect(prisma.stock.create).not.toHaveBeenCalled();
  });

  it('cree la ligne avec un seuil de 10 par defaut, rattachee a l ASC', async () => {
    prisma.ascProfile.findUnique.mockResolvedValue(ASC);
    prisma.medicament.findUnique.mockResolvedValue({ id: 'm-1' });
    prisma.stock.findUnique.mockResolvedValue(null);
    prisma.stock.create.mockResolvedValue({ id: 's-new' });

    await createStock('asc-u', { idMedicament: 'm-1', quantite: 30, unite: 'boite', datePeremption: '2027-01-31' });

    expect(prisma.stock.create).toHaveBeenCalledWith(expect.objectContaining({
      data: { idAsc: 'asc-1', idMedicament: 'm-1', quantite: 30, unite: 'boite', seuilAlerte: 10 },
    }));
  });
});

describe('updateStock', () => {
  beforeEach(() => prisma.ascProfile.findUnique.mockResolvedValue(ASC));

  it('refuse de modifier la ligne d un autre ASC (403, sans distinguer inexistante / etrangere)', async () => {
    prisma.stock.findUnique.mockResolvedValue({ id: 's1', idAsc: 'asc-autre' });
    await expect(updateStock('asc-u', 's1', { quantite: 3, unite: 'boite' })).rejects.toBeInstanceOf(ForbiddenError);

    prisma.stock.findUnique.mockResolvedValue(null);
    await expect(updateStock('asc-u', 's-x', { quantite: 3, unite: 'boite' })).rejects.toBeInstanceOf(ForbiddenError);
    expect(prisma.stock.update).not.toHaveBeenCalled();
  });

  it('ne touche au seuil et a la peremption que s ils sont fournis', async () => {
    prisma.stock.findUnique.mockResolvedValue({ id: 's1', idAsc: 'asc-1' });
    prisma.stock.update.mockResolvedValue({ id: 's1' });

    await updateStock('asc-u', 's1', { quantite: 7, unite: 'boite' });
    expect(prisma.stock.update).toHaveBeenCalledWith(expect.objectContaining({ data: { quantite: 7, unite: 'boite' } }));

    await updateStock('asc-u', 's1', { quantite: 7, unite: 'boite', seuilAlerte: 0, datePeremption: '2027-06-01' });
    expect(prisma.stock.update).toHaveBeenLastCalledWith(expect.objectContaining({
      data: { quantite: 7, unite: 'boite', seuilAlerte: 0 },
    }));
  });
});

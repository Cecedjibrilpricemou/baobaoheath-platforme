// Lots de stock, approvisionnement et peremptions (addendum du 2026-09-28,
// points 1.3 et 1.4).
//
// Le stock reste un total ; les lots en donnent le detail. C'est ce detail qui
// permet de sortir au plus proche de la peremption plutot qu'au hasard, et de
// voir venir les dates.
import {
  enregistrerApprovisionnement,
  peremptionsProches,
  lotsDuMedicament,
  consommerLots,
} from '../src/services/approvisionnement.service';
import { JwtPayload } from '../src/types/auth.types';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../src/utils/app-error';

jest.mock('../src/config/prisma', () => {
  const prisma: Record<string, unknown> = {
    utilisateur: { findUnique: jest.fn() },
    medicament: { findMany: jest.fn() },
    stock: { findFirst: jest.fn(), upsert: jest.fn() },
    lotStock: { findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
    approvisionnement: { create: jest.fn(), findMany: jest.fn(), findUniqueOrThrow: jest.fn() },
  };
  prisma['$transaction'] = jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(prisma));
  return { prisma };
});
jest.mock('../src/config/redis', () => ({ getRedis: () => null }));
jest.mock('../src/services/numero.service', () => ({ prochainNumero: jest.fn() }));

type M = jest.Mock;
const { prisma } = jest.requireMock('../src/config/prisma') as {
  prisma: {
    utilisateur: { findUnique: M };
    medicament: { findMany: M };
    stock: { findFirst: M; upsert: M };
    lotStock: { findMany: M; create: M; update: M };
    approvisionnement: { create: M; findMany: M; findUniqueOrThrow: M };
    $transaction: M;
  };
};
const { prochainNumero } = jest.requireMock('../src/services/numero.service') as { prochainNumero: M };

const pharmacien: JwtPayload = { userId: 'pharma-1', role: 'PHARMACIEN', sessionId: 's' } as JwtPayload;

const DEMAIN = new Date(Date.now() + 86_400_000).toISOString();
const DANS_DEUX_ANS = new Date(Date.now() + 730 * 86_400_000).toISOString();

const approRow = {
  id: 'ap-1', numero: 'AP-2026-000001', numeroFacture: 'F-42', fournisseur: 'Grossiste Kindia',
  dateFacture: new Date('2026-09-30'), justificatifUrl: null, montantTotalGnf: 5000,
  creeLe: new Date(),
  saisiPar: { id: 'pharma-1', prenom: 'Ousmane', nom: 'Pricemou' },
  lots: [],
};

beforeEach(() => {
  jest.resetAllMocks();
  prisma.$transaction.mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn(prisma));
  prisma.utilisateur.findUnique.mockResolvedValue({ idStructure: 'struct-P' });
  prochainNumero.mockResolvedValue('AP-2026-000001');
});

describe('enregistrerApprovisionnement', () => {
  const facture = {
    fournisseur: 'Grossiste Kindia',
    dateFacture: '2026-09-30T00:00:00Z',
    numeroFacture: 'F-42',
    lignes: [{ idMedicament: 'm-1', quantite: 300, datePeremption: DANS_DEUX_ANS, prixAchatGnf: 800 }],
  };

  it('refuse un compte sans structure', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue({ idStructure: null });
    await expect(enregistrerApprovisionnement(pharmacien, facture)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('refuse une facture sans ligne', async () => {
    await expect(enregistrerApprovisionnement(pharmacien, { ...facture, lignes: [] }))
      .rejects.toBeInstanceOf(ValidationError);
  });

  // Une facture qui cite un produit inconnu est une facture qu'on ne sait pas
  // ranger.
  it('refuse un produit hors catalogue', async () => {
    prisma.medicament.findMany.mockResolvedValue([]);
    await expect(enregistrerApprovisionnement(pharmacien, facture)).rejects.toBeInstanceOf(ValidationError);
    expect(prisma.approvisionnement.create).not.toHaveBeenCalled();
  });

  // Laisser entrer un lot deja perime le ferait sortir plus tard.
  it('refuse un lot deja perime', async () => {
    prisma.medicament.findMany.mockResolvedValue([{ id: 'm-1' }]);
    const perime = { ...facture, lignes: [{ idMedicament: 'm-1', quantite: 10, datePeremption: '2020-01-01T00:00:00Z' }] };
    await expect(enregistrerApprovisionnement(pharmacien, perime)).rejects.toBeInstanceOf(ValidationError);
  });

  it('cree un lot par ligne et augmente le total du stock', async () => {
    prisma.medicament.findMany.mockResolvedValue([{ id: 'm-1' }]);
    prisma.stock.upsert.mockResolvedValue({ id: 'st-1' });
    prisma.approvisionnement.create.mockResolvedValue({ id: 'ap-1' });
    prisma.lotStock.create.mockResolvedValue({});
    prisma.approvisionnement.findUniqueOrThrow.mockResolvedValue(approRow);

    await enregistrerApprovisionnement(pharmacien, facture);

    // Le total suit, et la ligne de stock est creee au besoin : une premiere
    // livraison ne doit pas echouer faute de ligne.
    const upsert = prisma.stock.upsert.mock.calls[0][0];
    expect(upsert.update).toEqual({ quantite: { increment: 300 } });
    expect(upsert.create).toMatchObject({ idStructure: 'struct-P', idMedicament: 'm-1', quantite: 300 });

    const lot = prisma.lotStock.create.mock.calls[0][0].data;
    expect(lot).toMatchObject({ idStock: 'st-1', idApprovisionnement: 'ap-1', quantite: 300, quantiteRecue: 300 });
    expect(lot.datePeremption).toBeInstanceOf(Date);
  });

  it('calcule le montant de la facture depuis ses lignes', async () => {
    prisma.medicament.findMany.mockResolvedValue([{ id: 'm-1' }, { id: 'm-2' }]);
    prisma.stock.upsert.mockResolvedValue({ id: 'st-1' });
    prisma.approvisionnement.create.mockResolvedValue({ id: 'ap-1' });
    prisma.lotStock.create.mockResolvedValue({});
    prisma.approvisionnement.findUniqueOrThrow.mockResolvedValue(approRow);

    await enregistrerApprovisionnement(pharmacien, {
      ...facture,
      lignes: [
        { idMedicament: 'm-1', quantite: 10, prixAchatGnf: 100 },
        { idMedicament: 'm-2', quantite: 5, prixAchatGnf: 200 },
      ],
    });

    expect(prisma.approvisionnement.create.mock.calls[0][0].data.montantTotalGnf).toBe(2000);
  });
});

describe('consommerLots — sortie au plus proche de la peremption', () => {
  const maintenant = new Date('2026-09-30T12:00:00Z');

  it('ne prend que des lots non perimes', async () => {
    prisma.lotStock.findMany.mockResolvedValue([]);

    await expect(consommerLots(prisma as never, 'st-1', 5, maintenant))
      .rejects.toBeInstanceOf(ConflictError);

    const { where, orderBy } = prisma.lotStock.findMany.mock.calls[0][0];
    expect(where.quantite).toEqual({ gt: 0 });
    // Sans date, ou avec une date encore devant nous.
    expect(where.OR).toEqual([{ datePeremption: null }, { datePeremption: { gt: maintenant } }]);
    // Le plus proche de sa peremption d'abord ; les lots sans date en dernier.
    expect(orderBy).toEqual([{ datePeremption: { sort: 'asc', nulls: 'last' } }, { creeLe: 'asc' }]);
  });

  // Le total peut suffire alors que la sortie echoue : un lot perime ne sort
  // pas. Dire « stock insuffisant » serait faux.
  it('refuse quand les lots valides ne suffisent pas, et le dit', async () => {
    prisma.lotStock.findMany.mockResolvedValue([{ id: 'l-1', quantite: 3 }]);

    await expect(consommerLots(prisma as never, 'st-1', 10, maintenant))
      .rejects.toThrow(/3 disponible\(s\) sur 10/);
    expect(prisma.lotStock.update).not.toHaveBeenCalled();
  });

  it('epuise le premier lot avant d entamer le suivant', async () => {
    prisma.lotStock.findMany.mockResolvedValue([
      { id: 'l-proche', quantite: 4 },
      { id: 'l-lointain', quantite: 100 },
    ]);
    prisma.lotStock.update.mockResolvedValue({});

    const sorties = await consommerLots(prisma as never, 'st-1', 10, maintenant);

    expect(sorties).toEqual([
      { idLot: 'l-proche', quantite: 4 },
      { idLot: 'l-lointain', quantite: 6 },
    ]);
    expect(prisma.lotStock.update.mock.calls[0][0]).toMatchObject({
      where: { id: 'l-proche' }, data: { quantite: { decrement: 4 } },
    });
  });

  it('s arrete des que la quantite est atteinte', async () => {
    prisma.lotStock.findMany.mockResolvedValue([
      { id: 'l-1', quantite: 50 },
      { id: 'l-2', quantite: 50 },
    ]);
    prisma.lotStock.update.mockResolvedValue({});

    const sorties = await consommerLots(prisma as never, 'st-1', 20, maintenant);

    expect(sorties).toEqual([{ idLot: 'l-1', quantite: 20 }]);
    expect(prisma.lotStock.update).toHaveBeenCalledTimes(1);
  });
});

describe('peremptionsProches', () => {
  it('ne regarde que les lots non vides de sa structure, avec une date', async () => {
    prisma.lotStock.findMany.mockResolvedValue([]);

    await peremptionsProches(pharmacien, 30);

    const { where, orderBy } = prisma.lotStock.findMany.mock.calls[0][0];
    expect(where.quantite).toEqual({ gt: 0 });
    expect(where.stock).toEqual({ idStructure: 'struct-P' });
    expect(where.datePeremption.not).toBeNull();
    expect(where.datePeremption.lte).toBeInstanceOf(Date);
    // Le plus urgent en tete.
    expect(orderBy).toEqual({ datePeremption: 'asc' });
  });

  // Les perimes ne sont pas seulement a surveiller : ils sont a retirer.
  it('signale un lot deja perime', async () => {
    prisma.lotStock.findMany.mockResolvedValue([{
      id: 'l-1', numeroLot: 'A42', quantite: 12,
      datePeremption: new Date(Date.now() - 5 * 86_400_000),
      stock: { unite: 'boite', medicament: { id: 'm-1', dci: 'Paracetamol', nomCommercial: 'Doliprane', dosage: '500mg', forme: 'comprime' } },
    }]);

    const [p] = await peremptionsProches(pharmacien);

    expect(p!.perime).toBe(true);
    expect(p!.joursRestants).toBeLessThan(0);
    expect(p!.medicament.dci).toBe('Paracetamol');
    expect(p!.unite).toBe('boite');
  });

  it('compte les jours restants d un lot encore valide', async () => {
    prisma.lotStock.findMany.mockResolvedValue([{
      id: 'l-2', numeroLot: null, quantite: 30,
      datePeremption: new Date(Date.now() + 10 * 86_400_000),
      stock: { unite: 'boite', medicament: { id: 'm-1', dci: 'Paracetamol', nomCommercial: null, dosage: '500mg', forme: 'comprime' } },
    }]);

    const [p] = await peremptionsProches(pharmacien);

    expect(p!.perime).toBe(false);
    expect(p!.joursRestants).toBeGreaterThanOrEqual(9);
  });
});

describe('lotsDuMedicament', () => {
  it('rend introuvable un produit absent de l officine', async () => {
    prisma.stock.findFirst.mockResolvedValue(null);
    await expect(lotsDuMedicament(pharmacien, 'm-x')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('rend les lots du plus proche au plus lointain', async () => {
    prisma.stock.findFirst.mockResolvedValue({
      id: 'st-1', unite: 'boite',
      medicament: { id: 'm-1', dci: 'Paracetamol', nomCommercial: 'Doliprane', dosage: '500mg', forme: 'comprime' },
      lots: [
        { id: 'l-1', numeroLot: 'A', quantite: 10, quantiteRecue: 20, datePeremption: new Date(DEMAIN), prixAchatGnf: 500 },
      ],
    });

    const lots = await lotsDuMedicament(pharmacien, 'm-1');

    expect(lots).toHaveLength(1);
    expect(lots[0]).toMatchObject({ numeroLot: 'A', quantite: 10, quantiteRecue: 20 });
    const { orderBy } = prisma.stock.findFirst.mock.calls[0][0].include.lots;
    expect(orderBy).toEqual([{ datePeremption: { sort: 'asc', nulls: 'last' } }, { creeLe: 'asc' }]);
  });
});

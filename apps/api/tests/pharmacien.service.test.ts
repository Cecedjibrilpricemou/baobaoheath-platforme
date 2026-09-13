// Delivrance en pharmacie : c'est ici qu'un stock est decremente et qu'une
// ordonnance sort de circulation. Les invariants a proteger : jamais plus que
// prescrit, jamais sans stock, jamais deux fois, jamais sur une allergie
// passee sous silence.
import {
  delivrerOrdonnance,
  getOrdonnances,
  reapprovisionnerStock,
  scanPatient,
} from '../src/services/pharmacien.service';
import { ForbiddenError, NotFoundError, ValidationError } from '../src/utils/app-error';

jest.mock('../src/config/prisma', () => ({
  prisma: {
    utilisateur: { findUnique: jest.fn() },
    patientProfile: { findUnique: jest.fn() },
    ordonnance: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    medicament: { findUnique: jest.fn() },
    stock: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    $transaction: jest.fn(),
  },
}));
jest.mock('../src/services/parametres.service', () => ({ getValeursParametres: jest.fn() }));
jest.mock('../src/utils/password.utils', () => ({ hashPassword: jest.fn() }));

const { prisma } = jest.requireMock('../src/config/prisma') as {
  prisma: {
    utilisateur: { findUnique: jest.Mock };
    patientProfile: { findUnique: jest.Mock };
    ordonnance: { findUnique: jest.Mock; findMany: jest.Mock; update: jest.Mock };
    medicament: { findUnique: jest.Mock };
    stock: { findFirst: jest.Mock; create: jest.Mock; update: jest.Mock; updateMany: jest.Mock };
    $transaction: jest.Mock;
  };
};
const { getValeursParametres } = jest.requireMock('../src/services/parametres.service') as { getValeursParametres: jest.Mock };

const PHARMACIEN = {
  id: 'ph-u', idStructure: 'pharma-1',
  structure: { id: 'pharma-1', type: 'PHARMACIE', prefecture: 'Kindia' },
  pharmacienProfile: {},
};
const PARACETAMOL = { id: 'm-1', dci: 'Paracetamol', nomCommercial: 'Doliprane', forme: 'cp', dosage: '500mg', prixUnitaireGnf: 1000 };

function pharmacienValide() {
  prisma.utilisateur.findUnique.mockResolvedValue(PHARMACIEN);
}

afterEach(() => jest.resetAllMocks());

describe('garde commune : le compte doit etre rattache a une pharmacie', () => {
  it('refuse un pharmacien sans structure', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue({ id: 'ph-u', idStructure: null, structure: null });
    await expect(scanPatient('qr-1', 'ph-u')).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('refuse une structure qui n est pas une pharmacie', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue({ ...PHARMACIEN, structure: { ...PHARMACIEN.structure, type: 'CENTRE' } });
    await expect(scanPatient('qr-1', 'ph-u')).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('scanPatient', () => {
  beforeEach(pharmacienValide);

  it('404 sur un QR code inconnu', async () => {
    prisma.patientProfile.findUnique.mockResolvedValue(null);
    await expect(scanPatient('qr-x', 'ph-u')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('aplatit les ordonnances en attente, calcule le prix et signale une allergie au principe actif', async () => {
    prisma.patientProfile.findUnique.mockResolvedValue({
      id: 'p1', qrCode: 'qr-1', dateNaissance: new Date('1990-01-01'), groupeSanguin: 'O+',
      allergies: ['paracetamol'],
      utilisateur: { id: 'u1', prenom: 'Awa', nom: 'Diallo', telephone: 't' },
      consultations: [{
        asc: { utilisateur: { prenom: 'Mamadou', nom: 'Bah' } },
        ordonnances: [
          { id: 'o1', posologie: '1cp', frequence: '3/j', dureeJours: 5, quantite: 15, statut: 'EN_ATTENTE', signeLe: null, creeLe: new Date('2026-09-01'), medicament: PARACETAMOL, signataire: null },
          { id: 'o2', posologie: '1cp', frequence: '1/j', dureeJours: 3, quantite: 3, statut: 'EN_ATTENTE', signeLe: new Date('2026-09-02'), creeLe: new Date('2026-09-01'), medicament: { ...PARACETAMOL, id: 'm-2', dci: 'Amoxicilline', nomCommercial: null, prixUnitaireGnf: 2500 }, signataire: { prenom: 'Dr', nom: 'Camara' } },
        ],
      }],
    });

    const res = await scanPatient('qr-1', 'ph-u');

    expect(res.patient).toEqual(expect.objectContaining({ prenom: 'Awa', groupeSanguin: 'O+', allergiesCritiques: ['paracetamol'] }));
    expect(res.totalOrdonnances).toBe(2);
    const [o1, o2] = res.ordonnances;
    expect(o1).toEqual(expect.objectContaining({ id: 'o1', prixTotalGnf: 15_000, alerteAllergie: true, medecinNom: 'Mamadou Bah' }));
    expect(o2).toEqual(expect.objectContaining({ id: 'o2', prixTotalGnf: 7_500, alerteAllergie: false, medecinNom: 'Dr Camara' }));
  });
});

describe('delivrerOrdonnance', () => {
  const ORDONNANCE = { id: 'o1', statut: 'EN_ATTENTE', quantite: 10, idMedicament: 'm-1', medicament: PARACETAMOL };

  beforeEach(() => {
    pharmacienValide();
    prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn({
      stock: { updateMany: prisma.stock.updateMany },
      ordonnance: { update: prisma.ordonnance.update },
    }));
  });

  it('refuse une ordonnance deja delivree', async () => {
    prisma.ordonnance.findUnique.mockResolvedValue({ ...ORDONNANCE, statut: 'DELIVREE' });
    await expect(delivrerOrdonnance('o1', 'ph-u', {})).rejects.toBeInstanceOf(ValidationError);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('refuse de delivrer plus que la quantite prescrite', async () => {
    prisma.ordonnance.findUnique.mockResolvedValue(ORDONNANCE);
    await expect(delivrerOrdonnance('o1', 'ph-u', { quantiteDelivree: 11 })).rejects.toBeInstanceOf(ValidationError);
  });

  it('refuse sans ligne de stock dans CETTE pharmacie', async () => {
    prisma.ordonnance.findUnique.mockResolvedValue(ORDONNANCE);
    prisma.stock.findFirst.mockResolvedValue(null);

    await expect(delivrerOrdonnance('o1', 'ph-u', {})).rejects.toBeInstanceOf(ValidationError);
    expect(prisma.stock.findFirst).toHaveBeenCalledWith({ where: { idMedicament: 'm-1', idStructure: 'pharma-1' } });
  });

  it('echoue si le stock a baisse entre la lecture et le decrement (check-and-decrement atomique)', async () => {
    prisma.ordonnance.findUnique.mockResolvedValue(ORDONNANCE);
    prisma.stock.findFirst.mockResolvedValue({ id: 's1', quantite: 10 });
    prisma.stock.updateMany.mockResolvedValue({ count: 0 });

    await expect(delivrerOrdonnance('o1', 'ph-u', {})).rejects.toBeInstanceOf(ValidationError);
    expect(prisma.ordonnance.update).not.toHaveBeenCalled();
  });

  it('decremente le stock, passe l ordonnance a DELIVREE et facture la quantite reellement delivree', async () => {
    prisma.ordonnance.findUnique.mockResolvedValue(ORDONNANCE);
    prisma.stock.findFirst.mockResolvedValue({ id: 's1', quantite: 50 });
    prisma.stock.updateMany.mockResolvedValue({ count: 1 });
    prisma.ordonnance.update.mockResolvedValue({ ...ORDONNANCE, statut: 'DELIVREE' });

    const res = await delivrerOrdonnance('o1', 'ph-u', { quantiteDelivree: 6 });

    expect(prisma.stock.updateMany).toHaveBeenCalledWith({
      where: { id: 's1', quantite: { gte: 6 } },
      data: { quantite: { decrement: 6 } },
    });
    expect(prisma.ordonnance.update).toHaveBeenCalledWith(expect.objectContaining({ data: { statut: 'DELIVREE' } }));
    expect(res.quantiteDelivree).toBe(6);
    expect(res.montantGnf).toBe(6_000);
  });

  it('delivre la quantite prescrite par defaut', async () => {
    prisma.ordonnance.findUnique.mockResolvedValue(ORDONNANCE);
    prisma.stock.findFirst.mockResolvedValue({ id: 's1', quantite: 50 });
    prisma.stock.updateMany.mockResolvedValue({ count: 1 });
    prisma.ordonnance.update.mockResolvedValue({ ...ORDONNANCE, statut: 'DELIVREE' });

    const res = await delivrerOrdonnance('o1', 'ph-u', {});
    expect(res.quantiteDelivree).toBe(10);
    expect(res.montantGnf).toBe(10_000);
  });
});

describe('getOrdonnances — perimetre', () => {
  it('ne liste que les ordonnances des patients de la prefecture de la pharmacie, sans telephone', async () => {
    pharmacienValide();
    prisma.ordonnance.findMany.mockResolvedValue([{
      id: 'o1', posologie: '1cp', frequence: '2/j', dureeJours: 3, quantite: 6, creeLe: new Date(), signeLe: null,
      medicament: { id: 'm-1', dci: 'Paracetamol', nomCommercial: 'Doliprane', forme: 'cp', dosage: '500mg' },
      consultation: { patient: { qrCode: 'qr-1', utilisateur: { prenom: 'Awa', nom: 'Diallo' } } },
    }]);

    const res = await getOrdonnances('ph-u');

    expect(prisma.ordonnance.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { statut: 'EN_ATTENTE', consultation: { patient: { prefecture: 'Kindia' } } },
    }));
    expect(res).toEqual([expect.objectContaining({ id: 'o1', patient: { prenom: 'Awa', nom: 'Diallo', qrCode: 'qr-1' } })]);
    expect(JSON.stringify(res)).not.toContain('telephone');
  });
});

describe('reapprovisionnerStock', () => {
  beforeEach(() => {
    pharmacienValide();
    prisma.medicament.findUnique.mockResolvedValue(PARACETAMOL);
    getValeursParametres.mockResolvedValue({ facturation: { margePct: 15 } });
  });

  it('refuse une quantite nulle ou negative', async () => {
    await expect(reapprovisionnerStock('ph-u', { idMedicament: 'm-1', quantiteAjoutee: 0 })).rejects.toBeInstanceOf(ValidationError);
  });

  it('incremente une ligne existante sans toucher a sa marge si non fournie', async () => {
    prisma.stock.findFirst.mockResolvedValue({ id: 's1' });
    prisma.stock.update.mockResolvedValue({ id: 's1' });

    await reapprovisionnerStock('ph-u', { idMedicament: 'm-1', quantiteAjoutee: 20 });

    expect(prisma.stock.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 's1' },
      data: { quantite: { increment: 20 } },
    }));
    expect(prisma.stock.create).not.toHaveBeenCalled();
  });

  it('cree une ligne avec la marge par defaut de la plateforme (15 % du prix de reference)', async () => {
    prisma.stock.findFirst.mockResolvedValue(null);
    prisma.stock.create.mockResolvedValue({ id: 's-new' });

    await reapprovisionnerStock('ph-u', { idMedicament: 'm-1', quantiteAjoutee: 20 });

    expect(prisma.stock.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ idStructure: 'pharma-1', quantite: 20, margeGnf: 150 }),
    }));
  });

  it('la marge saisie par le pharmacien prime sur la marge par defaut', async () => {
    prisma.stock.findFirst.mockResolvedValue(null);
    prisma.stock.create.mockResolvedValue({ id: 's-new' });

    await reapprovisionnerStock('ph-u', { idMedicament: 'm-1', quantiteAjoutee: 20, margeGnf: 300 });

    expect(prisma.stock.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ margeGnf: 300 }),
    }));
  });
});

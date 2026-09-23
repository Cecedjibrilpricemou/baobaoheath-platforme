// Delivrance en pharmacie : c'est ici qu'un stock est decremente et qu'une
// ordonnance sort de circulation. Les invariants a proteger : jamais plus que
// prescrit, jamais sans stock, jamais deux fois, jamais sur une allergie
// passee sous silence.
import {
  delivrerLigneOrdonnance,
  getOrdonnances,
  reapprovisionnerStock,
  scanPatient,
  verifierOrdonnance,
} from '../src/services/pharmacien.service';
import { ForbiddenError, NotFoundError, ValidationError } from '../src/utils/app-error';

jest.mock('../src/config/prisma', () => ({
  prisma: {
    utilisateur: { findUnique: jest.fn() },
    patientProfile: { findUnique: jest.fn() },
    ordonnance: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    ligneOrdonnance: { findUnique: jest.fn(), update: jest.fn() },
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
    ligneOrdonnance: { findUnique: jest.Mock; update: jest.Mock };
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

const DANS_30_JOURS = new Date(Date.now() + 30 * 24 * 3600 * 1000);
const IL_Y_A_10_JOURS = new Date(Date.now() - 10 * 24 * 3600 * 1000);

/** Ordonnance signee et encore valide : le cas nominal du comptoir. */
type EtatOrdonnance = {
  id: string;
  numero: string;
  statut: string;
  codeVerification: string;
  valideJusquau: Date;
  signeLe: Date | null;
  signePar: string | null;
  creeLe: Date;
};

const ORD_VALIDE: EtatOrdonnance = {
  id: 'ord-1',
  numero: 'OR-2026-000001',
  statut: 'EN_ATTENTE',
  codeVerification: 'A7D27Y',
  valideJusquau: DANS_30_JOURS,
  signeLe: new Date('2026-09-01'),
  signePar: 'med-1',
  creeLe: new Date('2026-09-01'),
};

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

  it('rend les lignes de chaque ordonnance, calcule le prix et signale une allergie au principe actif', async () => {
    prisma.patientProfile.findUnique.mockResolvedValue({
      id: 'p1', qrCode: 'qr-1', dateNaissance: new Date('1990-01-01'), groupeSanguin: 'O+',
      allergies: ['paracetamol'],
      utilisateur: { id: 'u1', prenom: 'Awa', nom: 'Diallo', telephone: 't' },
      consultations: [{
        asc: { utilisateur: { prenom: 'Mamadou', nom: 'Bah' } },
        ordonnances: [
          {
            ...ORD_VALIDE, signataire: null,
            lignes: [
              { id: 'l1', posologie: '1cp', frequence: '3/j', dureeJours: 5, quantite: 15, statut: 'EN_ATTENTE', instructions: null, medicament: PARACETAMOL },
              { id: 'l2', posologie: '1cp', frequence: '1/j', dureeJours: 3, quantite: 3, statut: 'EN_ATTENTE', instructions: null, medicament: { ...PARACETAMOL, id: 'm-2', dci: 'Amoxicilline', nomCommercial: null, prixUnitaireGnf: 2500 } },
            ],
          },
        ],
      }],
    });

    const res = await scanPatient('qr-1', 'ph-u');

    expect(res.patient).toEqual(expect.objectContaining({ prenom: 'Awa', groupeSanguin: 'O+', allergiesCritiques: ['paracetamol'] }));
    expect(res.totalOrdonnances).toBe(1);
    const [ordonnance] = res.ordonnances;
    // Le numero est ce que le pharmacien lit sur le papier : il doit remonter.
    expect(ordonnance).toEqual(expect.objectContaining({ numero: 'OR-2026-000001', expiree: false, medecinNom: 'Mamadou Bah' }));
    const [l1, l2] = ordonnance.lignes;
    expect(l1).toEqual(expect.objectContaining({ id: 'l1', prixTotalGnf: 15_000, alerteAllergie: true }));
    expect(l2).toEqual(expect.objectContaining({ id: 'l2', prixTotalGnf: 7_500, alerteAllergie: false }));
    // Rien n'est encore delivre : le total porte sur les deux lignes.
    expect(ordonnance.totalGnf).toBe(22_500);
  });

  it('ne compte pas dans le total une ligne deja delivree ailleurs', async () => {
    prisma.patientProfile.findUnique.mockResolvedValue({
      id: 'p1', qrCode: 'qr-1', dateNaissance: new Date('1990-01-01'), groupeSanguin: null,
      allergies: [],
      utilisateur: { id: 'u1', prenom: 'Awa', nom: 'Diallo', telephone: 't' },
      consultations: [{
        asc: null,
        ordonnances: [{
          ...ORD_VALIDE, statut: 'PARTIELLEMENT_SERVIE', signataire: { prenom: 'Dr', nom: 'Camara' },
          lignes: [
            { id: 'l1', posologie: '1cp', frequence: '3/j', dureeJours: 5, quantite: 15, statut: 'DELIVREE', instructions: null, medicament: PARACETAMOL },
            { id: 'l2', posologie: '1cp', frequence: '1/j', dureeJours: 3, quantite: 3, statut: 'EN_ATTENTE', instructions: null, medicament: { ...PARACETAMOL, id: 'm-2', prixUnitaireGnf: 2500 } },
          ],
        }],
      }],
    });

    const [ordonnance] = (await scanPatient('qr-1', 'ph-u')).ordonnances;

    // Facturer 22 500 ferait payer deux fois le traitement deja delivre.
    expect(ordonnance.totalGnf).toBe(7_500);
  });
});

describe('delivrerLigneOrdonnance', () => {
  const LIGNE = {
    id: 'l1', statut: 'EN_ATTENTE', quantite: 10,
    idMedicament: 'm-1', idOrdonnance: 'ord-1',
    medicament: PARACETAMOL, ordonnance: ORD_VALIDE,
  };

  /** Ligne rattachee a une ordonnance dans l'etat decrit. */
  function ligneAvecOrdonnance(etat: Partial<EtatOrdonnance>) {
    return { ...LIGNE, ordonnance: { ...ORD_VALIDE, ...etat } };
  }

  beforeEach(() => {
    pharmacienValide();
    prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn({
      stock: { updateMany: prisma.stock.updateMany },
      ligneOrdonnance: { update: prisma.ligneOrdonnance.update },
      ordonnance: { findUnique: prisma.ordonnance.findUnique, update: prisma.ordonnance.update },
    }));
    // Etat du document relu par recalculerStatut apres la sortie de stock.
    prisma.ordonnance.findUnique.mockResolvedValue({
      ...ORD_VALIDE,
      lignes: [{ statut: 'DELIVREE' }],
    });
  });

  // ── Controles portes par le document (EF-05-07/08) ────────────────
  // Ils passent avant tout : rien ne doit sortir du stock sur une ordonnance
  // qui n'est pas opposable.

  it('refuse une ordonnance non signee par le prescripteur', async () => {
    prisma.ligneOrdonnance.findUnique.mockResolvedValue(ligneAvecOrdonnance({ signeLe: null }));

    await expect(delivrerLigneOrdonnance('l1', 'ph-u', {})).rejects.toThrow(/non signee/i);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('refuse une ordonnance expiree', async () => {
    prisma.ligneOrdonnance.findUnique.mockResolvedValue(
      ligneAvecOrdonnance({ valideJusquau: IL_Y_A_10_JOURS })
    );

    await expect(delivrerLigneOrdonnance('l1', 'ph-u', {})).rejects.toThrow(/expiree/i);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('refuse une ordonnance annulee', async () => {
    prisma.ligneOrdonnance.findUnique.mockResolvedValue(ligneAvecOrdonnance({ statut: 'ANNULEE' }));

    await expect(delivrerLigneOrdonnance('l1', 'ph-u', {})).rejects.toThrow(/annulee/i);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  // ── Controles portes par la ligne ─────────────────────────────────

  it('refuse un medicament deja delivre', async () => {
    prisma.ligneOrdonnance.findUnique.mockResolvedValue({ ...LIGNE, statut: 'DELIVREE' });
    await expect(delivrerLigneOrdonnance('l1', 'ph-u', {})).rejects.toBeInstanceOf(ValidationError);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('refuse de delivrer plus que la quantite prescrite', async () => {
    prisma.ligneOrdonnance.findUnique.mockResolvedValue(LIGNE);
    await expect(delivrerLigneOrdonnance('l1', 'ph-u', { quantiteDelivree: 11 })).rejects.toBeInstanceOf(ValidationError);
  });

  it('refuse sans ligne de stock dans CETTE pharmacie', async () => {
    prisma.ligneOrdonnance.findUnique.mockResolvedValue(LIGNE);
    prisma.stock.findFirst.mockResolvedValue(null);

    await expect(delivrerLigneOrdonnance('l1', 'ph-u', {})).rejects.toBeInstanceOf(ValidationError);
    expect(prisma.stock.findFirst).toHaveBeenCalledWith({ where: { idMedicament: 'm-1', idStructure: 'pharma-1' } });
  });

  it('echoue si le stock a baisse entre la lecture et le decrement (check-and-decrement atomique)', async () => {
    prisma.ligneOrdonnance.findUnique.mockResolvedValue(LIGNE);
    prisma.stock.findFirst.mockResolvedValue({ id: 's1', quantite: 10 });
    prisma.stock.updateMany.mockResolvedValue({ count: 0 });

    await expect(delivrerLigneOrdonnance('l1', 'ph-u', {})).rejects.toBeInstanceOf(ValidationError);
    expect(prisma.ligneOrdonnance.update).not.toHaveBeenCalled();
  });

  it('decremente le stock, passe la ligne a DELIVREE et facture la quantite reellement delivree', async () => {
    prisma.ligneOrdonnance.findUnique.mockResolvedValue(LIGNE);
    prisma.stock.findFirst.mockResolvedValue({ id: 's1', quantite: 50 });
    prisma.stock.updateMany.mockResolvedValue({ count: 1 });
    prisma.ligneOrdonnance.update.mockResolvedValue({ ...LIGNE, statut: 'DELIVREE' });

    const res = await delivrerLigneOrdonnance('l1', 'ph-u', { quantiteDelivree: 6 });

    expect(prisma.stock.updateMany).toHaveBeenCalledWith({
      where: { id: 's1', quantite: { gte: 6 } },
      data: { quantite: { decrement: 6 } },
    });
    expect(prisma.ligneOrdonnance.update).toHaveBeenCalledWith(expect.objectContaining({ data: { statut: 'DELIVREE' } }));
    expect(res.quantiteDelivree).toBe(6);
    expect(res.montantGnf).toBe(6_000);
  });

  it('passe le document a SERVIE quand sa derniere ligne sort', async () => {
    prisma.ligneOrdonnance.findUnique.mockResolvedValue(LIGNE);
    prisma.stock.findFirst.mockResolvedValue({ id: 's1', quantite: 50 });
    prisma.stock.updateMany.mockResolvedValue({ count: 1 });
    prisma.ligneOrdonnance.update.mockResolvedValue({ ...LIGNE, statut: 'DELIVREE' });

    await delivrerLigneOrdonnance('l1', 'ph-u', {});

    expect(prisma.ordonnance.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'ord-1' }, data: { statut: 'SERVIE' } })
    );
  });

  it('laisse le document PARTIELLEMENT_SERVIE tant qu il reste un medicament', async () => {
    prisma.ligneOrdonnance.findUnique.mockResolvedValue(LIGNE);
    prisma.stock.findFirst.mockResolvedValue({ id: 's1', quantite: 50 });
    prisma.stock.updateMany.mockResolvedValue({ count: 1 });
    prisma.ligneOrdonnance.update.mockResolvedValue({ ...LIGNE, statut: 'DELIVREE' });
    prisma.ordonnance.findUnique.mockResolvedValue({
      ...ORD_VALIDE,
      lignes: [{ statut: 'DELIVREE' }, { statut: 'EN_ATTENTE' }],
    });

    await delivrerLigneOrdonnance('l1', 'ph-u', {});

    expect(prisma.ordonnance.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { statut: 'PARTIELLEMENT_SERVIE' } })
    );
  });

  it('delivre la quantite prescrite par defaut', async () => {
    prisma.ligneOrdonnance.findUnique.mockResolvedValue(LIGNE);
    prisma.stock.findFirst.mockResolvedValue({ id: 's1', quantite: 50 });
    prisma.stock.updateMany.mockResolvedValue({ count: 1 });
    prisma.ligneOrdonnance.update.mockResolvedValue({ ...LIGNE, statut: 'DELIVREE' });

    const res = await delivrerLigneOrdonnance('l1', 'ph-u', {});
    expect(res.quantiteDelivree).toBe(10);
    expect(res.montantGnf).toBe(10_000);
  });
});

// EF-07-01 : le comptoir doit pouvoir controler une ordonnance papier sans le
// QR du patient.
describe('verifierOrdonnance', () => {
  const PATIENT = {
    allergies: [], dateNaissance: new Date('1990-01-01'), sexe: 'F', groupeSanguin: null,
    utilisateur: { prenom: 'Awa', nom: 'Diallo' },
  };

  function ordonnanceComplete(etat: Partial<EtatOrdonnance> = {}) {
    return {
      ...ORD_VALIDE, ...etat,
      signataire: { prenom: 'Dr', nom: 'Camara' },
      lignes: [{ id: 'l1', posologie: '1cp', frequence: '3/j', dureeJours: 5, quantite: 15, statut: 'EN_ATTENTE', instructions: null, medicament: PARACETAMOL }],
      consultation: { asc: null, patient: PATIENT },
    };
  }

  beforeEach(pharmacienValide);

  it('accepte le bon couple numero + code', async () => {
    prisma.ordonnance.findUnique.mockResolvedValue(ordonnanceComplete());

    const res = await verifierOrdonnance('ph-u', { numero: 'OR-2026-000001', codeVerification: 'A7D27Y' });

    expect(res.valide).toBe(true);
    expect(res.motif).toBeUndefined();
    expect(res.ordonnance?.numero).toBe('OR-2026-000001');
    expect(res.patient?.nom).toBe('Diallo');
  });

  it('tolere la casse et les espaces de la saisie au comptoir', async () => {
    prisma.ordonnance.findUnique.mockResolvedValue(ordonnanceComplete());

    const res = await verifierOrdonnance('ph-u', { numero: ' or-2026-000001 ', codeVerification: ' a7d27y ' });

    expect(res.valide).toBe(true);
  });

  // Un code faux et un numero inconnu doivent etre indiscernables : sinon on
  // peut enumerer les numeros valides en observant la difference.
  it('donne la meme reponse pour un code faux et pour un numero inconnu', async () => {
    prisma.ordonnance.findUnique.mockResolvedValue(ordonnanceComplete());
    const codeFaux = await verifierOrdonnance('ph-u', { numero: 'OR-2026-000001', codeVerification: 'ZZZZZZ' });

    prisma.ordonnance.findUnique.mockResolvedValue(null);
    const numeroInconnu = await verifierOrdonnance('ph-u', { numero: 'OR-2026-999999', codeVerification: 'A7D27Y' });

    expect(codeFaux).toEqual(numeroInconnu);
    expect(codeFaux.valide).toBe(false);
    expect(codeFaux.ordonnance).toBeUndefined();
  });

  it('refuse une ordonnance expiree en donnant la date', async () => {
    prisma.ordonnance.findUnique.mockResolvedValue(ordonnanceComplete({ valideJusquau: IL_Y_A_10_JOURS }));

    const res = await verifierOrdonnance('ph-u', { numero: 'OR-2026-000001', codeVerification: 'A7D27Y' });

    expect(res.valide).toBe(false);
    expect(res.motif).toMatch(/expiree/i);
    // L'ordonnance reste renvoyee : le pharmacien doit pouvoir l'expliquer au
    // patient, pas seulement lui opposer un refus.
    expect(res.ordonnance?.numero).toBe('OR-2026-000001');
  });

  it('refuse une ordonnance deja entierement servie', async () => {
    prisma.ordonnance.findUnique.mockResolvedValue(ordonnanceComplete({ statut: 'SERVIE' }));

    const res = await verifierOrdonnance('ph-u', { numero: 'OR-2026-000001', codeVerification: 'A7D27Y' });

    expect(res.valide).toBe(false);
    expect(res.motif).toMatch(/servie/i);
  });
});

describe('getOrdonnances — perimetre', () => {
  it('ne liste que les ordonnances signees des patients de la prefecture, sans telephone', async () => {
    pharmacienValide();
    prisma.ordonnance.findMany.mockResolvedValue([{
      id: 'ord-1', numero: 'OR-2026-000001', statut: 'EN_ATTENTE',
      valideJusquau: DANS_30_JOURS, creeLe: new Date(), signeLe: new Date('2026-09-01'),
      lignes: [{ medicament: { id: 'm-1', dci: 'Paracetamol', nomCommercial: 'Doliprane', forme: 'cp', dosage: '500mg' } }],
      consultation: { patient: { qrCode: 'qr-1', utilisateur: { prenom: 'Awa', nom: 'Diallo' } } },
    }]);

    const res = await getOrdonnances('ph-u');

    expect(prisma.ordonnance.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        statut: { in: ['EN_ATTENTE', 'PARTIELLEMENT_SERVIE'] },
        // Une ordonnance non signee n'est pas opposable : elle n'a rien a
        // faire dans la file du comptoir.
        signeLe: { not: null },
        consultation: { patient: { prefecture: 'Kindia' } },
      },
    }));
    expect(res).toEqual([expect.objectContaining({
      numero: 'OR-2026-000001',
      expiree: false,
      patient: { prenom: 'Awa', nom: 'Diallo', qrCode: 'qr-1' },
    })]);
    expect(res[0].medicaments).toEqual([expect.objectContaining({ dci: 'Paracetamol' })]);
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

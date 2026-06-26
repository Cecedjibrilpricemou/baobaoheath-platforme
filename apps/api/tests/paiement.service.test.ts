import {
  initierPaiement,
  verifierStatutPaiement,
  confirmerPaiement,
  annulerPaiement,
} from '../src/services/paiement.service';
import { JwtPayload } from '../src/types/auth.types';
import { ForbiddenError, NotFoundError, ValidationError } from '../src/utils/app-error';

jest.mock('../src/config/prisma', () => ({
  prisma: {
    consultation: { findUnique: jest.fn() },
    facture: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    patientProfile: { findUnique: jest.fn() },
    utilisateur: { findUnique: jest.fn() },
  },
}));

jest.mock('../src/services/payment-provider.service', () => ({
  initierPaiementSimule: jest.fn(),
}));

const { prisma } = jest.requireMock('../src/config/prisma') as {
  prisma: {
    consultation: { findUnique: jest.Mock };
    facture: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    patientProfile: { findUnique: jest.Mock };
    utilisateur: { findUnique: jest.Mock };
  };
};

const { initierPaiementSimule } = jest.requireMock('../src/services/payment-provider.service') as {
  initierPaiementSimule: jest.Mock;
};

function makeUser(role: string, userId = 'user-1'): JwtPayload {
  return { userId, role, sessionId: 'sess-1' } as JwtPayload;
}

const PROVIDER_OK = {
  provider: 'SIMULATION_ORANGE_MONEY',
  referenceOperateur: 'OM-SIM-123',
  statut: 'EN_ATTENTE',
};

beforeEach(() => {
  initierPaiementSimule.mockResolvedValue(PROVIDER_OK);
});

afterEach(() => jest.resetAllMocks());

// ── initierPaiement ───────────────────────────────────────────────────────────
describe('initierPaiement', () => {
  const baseConsultation = {
    id: 'consult-1',
    tarifGnf: null,
    facture: null,
    patient: { id: 'patient-1', idUtilisateur: 'user-1' },
  };

  it('uses server-side tariff when tarifGnf is set', async () => {
    prisma.consultation.findUnique.mockResolvedValue({
      ...baseConsultation,
      tarifGnf: 8000,
    });
    prisma.facture.create.mockResolvedValue({ id: 'facture-1', montantGnf: 8000 });

    await initierPaiement('user-1', {
      idConsultation: 'consult-1',
      montantGnf: 999999,
      modePaiement: 'ORANGE_MONEY',
    });

    const createCall = prisma.facture.create.mock.calls[0][0];
    expect(createCall.data.montantGnf).toBe(8000);
  });

  it('caps client-provided amount at 10 000 000 GNF', async () => {
    prisma.consultation.findUnique.mockResolvedValue(baseConsultation);
    prisma.facture.create.mockResolvedValue({ id: 'facture-1', montantGnf: 10_000_000 });

    await initierPaiement('user-1', {
      idConsultation: 'consult-1',
      montantGnf: 99_000_000,
      modePaiement: 'ORANGE_MONEY',
    });

    const createCall = prisma.facture.create.mock.calls[0][0];
    expect(createCall.data.montantGnf).toBe(10_000_000);
  });

  it('rejects when consultation belongs to another patient', async () => {
    prisma.consultation.findUnique.mockResolvedValue({
      ...baseConsultation,
      patient: { id: 'other-patient', idUtilisateur: 'other-user' },
    });

    await expect(
      initierPaiement('user-1', {
        idConsultation: 'consult-1',
        montantGnf: 5000,
        modePaiement: 'ORANGE_MONEY',
      })
    ).rejects.toThrow('Acces refuse');
  });

  it('rejects when consultation not found', async () => {
    prisma.consultation.findUnique.mockResolvedValue(null);

    await expect(
      initierPaiement('user-1', {
        idConsultation: 'missing',
        montantGnf: 5000,
        modePaiement: 'ORANGE_MONEY',
      })
    ).rejects.toThrow('Consultation non trouvee');
  });

  it('rejects when a facture already exists', async () => {
    prisma.consultation.findUnique.mockResolvedValue({
      ...baseConsultation,
      facture: { id: 'existing-facture' },
    });

    await expect(
      initierPaiement('user-1', {
        idConsultation: 'consult-1',
        montantGnf: 5000,
        modePaiement: 'ORANGE_MONEY',
      })
    ).rejects.toThrow('Une facture existe deja');
  });
});

// ── verifierStatutPaiement ────────────────────────────────────────────────────
describe('verifierStatutPaiement', () => {
  it('allows the patient who owns the invoice', async () => {
    prisma.facture.findUnique.mockResolvedValue({
      id: 'facture-1',
      patient: { idUtilisateur: 'user-1' },
    });

    await expect(verifierStatutPaiement('user-1', 'facture-1')).resolves.toBeTruthy();
  });

  it('throws ForbiddenError for another user', async () => {
    prisma.facture.findUnique.mockResolvedValue({
      id: 'facture-1',
      patient: { idUtilisateur: 'other-user' },
    });

    await expect(verifierStatutPaiement('user-1', 'facture-1')).rejects.toThrow('Acces refuse');
  });

  it('throws when facture not found', async () => {
    prisma.facture.findUnique.mockResolvedValue(null);

    await expect(verifierStatutPaiement('user-1', 'missing')).rejects.toThrow('Facture non trouvee');
  });
});

// ── confirmerPaiement ─────────────────────────────────────────────────────────
describe('confirmerPaiement', () => {
  const baseFacture = {
    id: 'facture-1',
    statut: 'EN_ATTENTE',
    consultation: {
      asc: { idStructure: 'struct-A' },
    },
  };

  it('allows ADMIN_NATIONAL to confirm any payment', async () => {
    prisma.facture.findUnique.mockResolvedValue(baseFacture);
    prisma.facture.update.mockResolvedValue({ ...baseFacture, statut: 'PAYEE' });

    await expect(
      confirmerPaiement(makeUser('ADMIN_NATIONAL'), 'facture-1', { referenceOperateur: 'REF-1' })
    ).resolves.toBeTruthy();
  });

  it('allows ADMIN_STRUCTURE from the same structure', async () => {
    prisma.facture.findUnique.mockResolvedValue(baseFacture);
    prisma.utilisateur.findUnique.mockResolvedValue({ idStructure: 'struct-A' });
    prisma.facture.update.mockResolvedValue({ ...baseFacture, statut: 'PAYEE' });

    await expect(
      confirmerPaiement(makeUser('ADMIN_STRUCTURE'), 'facture-1', { referenceOperateur: 'REF-1' })
    ).resolves.toBeTruthy();
  });

  it('throws ForbiddenError for ADMIN_STRUCTURE from a different structure', async () => {
    prisma.facture.findUnique.mockResolvedValue(baseFacture);
    prisma.utilisateur.findUnique.mockResolvedValue({ idStructure: 'struct-B' });

    await expect(
      confirmerPaiement(makeUser('ADMIN_STRUCTURE', 'admin-b'), 'facture-1', { referenceOperateur: 'REF-1' })
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('throws ValidationError when invoice already paid', async () => {
    prisma.facture.findUnique.mockResolvedValue({ ...baseFacture, statut: 'PAYEE' });

    await expect(
      confirmerPaiement(makeUser('ADMIN_NATIONAL'), 'facture-1', { referenceOperateur: 'REF-1' })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws NotFoundError when facture not found', async () => {
    prisma.facture.findUnique.mockResolvedValue(null);

    await expect(
      confirmerPaiement(makeUser('ADMIN_NATIONAL'), 'missing', { referenceOperateur: 'REF-1' })
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

// ── annulerPaiement ───────────────────────────────────────────────────────────
describe('annulerPaiement', () => {
  it('allows the patient to cancel a pending invoice', async () => {
    prisma.facture.findUnique.mockResolvedValue({
      id: 'facture-1',
      statut: 'EN_ATTENTE',
      patient: { idUtilisateur: 'user-1' },
    });
    prisma.facture.update.mockResolvedValue({ id: 'facture-1', statut: 'ANNULEE' });

    await expect(annulerPaiement('user-1', 'facture-1')).resolves.toBeTruthy();
  });

  it('rejects cancellation for a paid invoice', async () => {
    prisma.facture.findUnique.mockResolvedValue({
      id: 'facture-1',
      statut: 'PAYEE',
      patient: { idUtilisateur: 'user-1' },
    });

    await expect(annulerPaiement('user-1', 'facture-1')).rejects.toThrow(
      "Impossible d'annuler une facture deja payee"
    );
  });

  it('throws ForbiddenError for another user', async () => {
    prisma.facture.findUnique.mockResolvedValue({
      id: 'facture-1',
      statut: 'EN_ATTENTE',
      patient: { idUtilisateur: 'other-user' },
    });

    await expect(annulerPaiement('user-1', 'facture-1')).rejects.toThrow('Acces refuse');
  });
});

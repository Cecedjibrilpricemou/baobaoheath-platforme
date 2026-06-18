// tests/access-control.test.ts
// Integration tests for cross-structure access control

import {
  buildConsultationWhereForUser,
  buildPatientWhereForUser,
  assertCanAccessPatient,
} from '../src/services/access-control.service';
import { JwtPayload } from '../src/types/auth.types';
import { ForbiddenError } from '../src/utils/app-error';

// ── Prisma mock — one fn per model to avoid ordering issues ──────────────────
jest.mock('../src/config/prisma', () => ({
  prisma: {
    utilisateur:    { findUnique: jest.fn() },
    patientProfile: { findFirst: jest.fn() },
    ascProfile:     { findUnique: jest.fn() },
    medecinProfile: { findUnique: jest.fn() },
  },
}));

const { prisma } = jest.requireMock('../src/config/prisma') as {
  prisma: {
    utilisateur:    { findUnique: jest.Mock },
    patientProfile: { findFirst:  jest.Mock },
    ascProfile:     { findUnique: jest.Mock },
    medecinProfile: { findUnique: jest.Mock },
  }
};

function makeUser(role: string, userId = 'user-1'): JwtPayload {
  return { userId, role, sessionId: 'sess-1' } as JwtPayload;
}

afterEach(() => jest.resetAllMocks());

// ── Critical P0 security property ───────────────────────────────────────────
describe('P0 — MEDECIN must not see ALL completed consultations system-wide', () => {
  it('does not include a bare statut clause in the WHERE filter', async () => {
    // A MEDECIN with a structure profile
    prisma.utilisateur.findUnique.mockResolvedValue({
      role: 'MEDECIN', idStructure: 'structure-A',
      patientProfile: null, ascProfile: null,
      medecinProfile: { idStructure: 'structure-A' }, pharmacienProfile: null,
    });
    prisma.medecinProfile.findUnique.mockResolvedValue({ idStructure: 'structure-A' });

    const where = await buildConsultationWhereForUser(makeUser('MEDECIN'));
    const json  = JSON.stringify(where);

    // The removed bare clause would have contained these status values
    expect(json).not.toContain('"TERMINEE"');
    expect(json).not.toContain('"REFERENCEE"');
  });
});

// ── buildConsultationWhereForUser — MEDECIN ───────────────────────────────────
describe('buildConsultationWhereForUser — MEDECIN', () => {
  it('includes validated consultations', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue({
      role: 'MEDECIN', idStructure: 'structure-A',
      patientProfile: null, ascProfile: null,
      medecinProfile: { idStructure: 'structure-A' }, pharmacienProfile: null,
    });
    prisma.medecinProfile.findUnique.mockResolvedValue({ idStructure: 'structure-A' });

    const where = await buildConsultationWhereForUser(makeUser('MEDECIN', 'doc-1'));
    expect(where).toMatchObject({ OR: expect.arrayContaining([{ idMedecinValideur: 'doc-1' }]) });
  });

  it('includes structure-scoped consultations when structure is known', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue({
      role: 'MEDECIN', idStructure: 'structure-A',
      patientProfile: null, ascProfile: null,
      medecinProfile: { idStructure: 'structure-A' }, pharmacienProfile: null,
    });
    prisma.medecinProfile.findUnique.mockResolvedValue({ idStructure: 'structure-A' });

    const where = await buildConsultationWhereForUser(makeUser('MEDECIN'));
    expect(JSON.stringify(where)).toContain('structure-A');
  });

  it('only sees own validated consultations when profile has no structure', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue({
      role: 'MEDECIN', idStructure: null,
      patientProfile: null, ascProfile: null,
      medecinProfile: { idStructure: null }, pharmacienProfile: null,
    });
    prisma.medecinProfile.findUnique.mockResolvedValue({ idStructure: null });

    const where = await buildConsultationWhereForUser(makeUser('MEDECIN', 'doc-no-structure'));
    // Should only include validated consultations — no structure-wide access
    expect(where).toEqual({ OR: [{ idMedecinValideur: 'doc-no-structure' }] });
    expect(JSON.stringify(where)).not.toContain('idStructure');
  });
});

// ── buildConsultationWhereForUser — ASC ───────────────────────────────────────
describe('buildConsultationWhereForUser — ASC', () => {
  it('scopes consultations to the ASC own profile', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue({
      role: 'ASC', idStructure: 'structure-A',
      patientProfile: null,
      ascProfile: { id: 'asc-1', idStructure: 'structure-A' },
      medecinProfile: null, pharmacienProfile: null,
    });
    prisma.ascProfile.findUnique.mockResolvedValue({ id: 'asc-1', idStructure: 'structure-A' });

    const where = await buildConsultationWhereForUser(makeUser('ASC'));
    expect(JSON.stringify(where)).toContain('asc-1');
  });
});

// ── assertCanAccessPatient ────────────────────────────────────────────────────
describe('assertCanAccessPatient', () => {
  it('allows access when patient is within user scope', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue({
      role: 'ASC', idStructure: 'structure-A',
      patientProfile: null,
      ascProfile: { id: 'asc-1', idStructure: 'structure-A' },
      medecinProfile: null, pharmacienProfile: null,
    });
    prisma.patientProfile.findFirst.mockResolvedValue({ id: 'patient-1' });

    await expect(
      assertCanAccessPatient(makeUser('ASC'), 'patient-1')
    ).resolves.toBeUndefined();
  });

  it('throws ForbiddenError when patient is outside user scope', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue({
      role: 'ASC', idStructure: 'structure-B',
      patientProfile: null,
      ascProfile: { id: 'asc-2', idStructure: 'structure-B' },
      medecinProfile: null, pharmacienProfile: null,
    });
    // Patient not found within the scope → cross-structure access denied
    prisma.patientProfile.findFirst.mockResolvedValue(null);

    await expect(
      assertCanAccessPatient(makeUser('ASC'), 'patient-from-structure-A')
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('allows ADMIN_NATIONAL unrestricted access without any structure filter', async () => {
    // Admin roles skip the utilisateur lookup entirely (early return {})
    prisma.patientProfile.findFirst.mockResolvedValue({ id: 'patient-X' });

    await expect(
      assertCanAccessPatient(makeUser('ADMIN_NATIONAL'), 'patient-X')
    ).resolves.toBeUndefined();

    // Confirm the utilisateur table was never queried
    expect(prisma.utilisateur.findUnique).not.toHaveBeenCalled();
  });
});

// ── buildPatientWhereForUser ───────────────────────────────────────────────────
describe('buildPatientWhereForUser — cross-structure isolation', () => {
  it('PATIENT can only see their own record', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue({
      role: 'PATIENT', idStructure: null,
      patientProfile: { id: 'self-patient-id' },
      ascProfile: null, medecinProfile: null, pharmacienProfile: null,
    });

    const where = await buildPatientWhereForUser(makeUser('PATIENT'));
    expect(where).toEqual({ id: 'self-patient-id' });
  });

  it('MEDECIN without structure is limited to patients from consultations they validated', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue({
      role: 'MEDECIN', idStructure: null,
      patientProfile: null, ascProfile: null,
      medecinProfile: { idStructure: null }, pharmacienProfile: null,
    });

    const where = await buildPatientWhereForUser(makeUser('MEDECIN', 'doc-1'));
    // Must scope to validated consultations only — no structure-wide wildcard
    expect(where).toEqual({
      consultations: { some: { OR: [{ idMedecinValideur: 'doc-1' }] } },
    });
  });

  it('admins get unrestricted access', async () => {
    for (const role of ['ADMIN_REGIONAL', 'ADMIN_NATIONAL', 'SUPER_ADMIN']) {
      const where = await buildPatientWhereForUser(makeUser(role));
      expect(where).toEqual({});
    }
    expect(prisma.utilisateur.findUnique).not.toHaveBeenCalled();
  });
});

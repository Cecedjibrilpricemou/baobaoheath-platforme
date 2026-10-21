import { creerAgent, creerPharmacieAvecPharmacien } from '../src/services/admin-structure.service';
import { ForbiddenError, NotFoundError, ValidationError } from '../src/utils/app-error';
import type { JwtPayload } from '../src/types/auth.types';

jest.mock('../src/config/prisma', () => {
  const prisma: Record<string, unknown> = {
    utilisateur: { findUnique: jest.fn(), create: jest.fn() },
    structureSante: { findUnique: jest.fn(), create: jest.fn() },
    pharmacienProfile: { create: jest.fn() },
  };
  prisma['$transaction'] = jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(prisma));
  return { prisma };
});
jest.mock('../src/utils/password.utils', () => ({ hashPassword: jest.fn().mockResolvedValue('hashed') }));
jest.mock('../src/services/email.service', () => ({
  envoyerEmailAdminStructure: jest.fn(),
  envoyerEmailAgent: jest.fn(),
}));

type Mock = jest.Mock;
const { prisma } = jest.requireMock('../src/config/prisma') as {
  prisma: {
    utilisateur: { findUnique: Mock; create: Mock };
    structureSante: { findUnique: Mock; create: Mock };
    pharmacienProfile: { create: Mock };
    $transaction: Mock;
  };
};

const DTO = {
  nom: 'Pharmacie du CHU',
  prefecture: 'Conakry',
  pharmacien: {
    prenom: 'Aminata',
    nom: 'Diallo',
    telephone: '+224620000001',
  },
};

const SUPER_ADMIN = { userId: 'super-1', role: 'SUPER_ADMIN' } as JwtPayload;
const ADMIN_HOPITAL = { userId: 'admin-h-1', role: 'ADMIN_STRUCTURE' } as JwtPayload;

beforeEach(() => {
  jest.resetAllMocks();
  prisma.$transaction.mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn(prisma));
  prisma.utilisateur.findUnique.mockResolvedValue(null);
  prisma.structureSante.findUnique.mockResolvedValue(null);
  prisma.structureSante.create.mockResolvedValue({ id: 'pharmacie-1', type: 'PHARMACIE' });
  prisma.utilisateur.create.mockResolvedValue({
    id: 'pharmacien-1', telephone: DTO.pharmacien.telephone, email: null,
    prenom: DTO.pharmacien.prenom, nom: DTO.pharmacien.nom, role: 'PHARMACIEN',
  });
  prisma.pharmacienProfile.create.mockResolvedValue({});
});

describe('creerPharmacieAvecPharmacien', () => {
  it('crée une pharmacie fille de l’hôpital de son administrateur', async () => {
    prisma.utilisateur.findUnique.mockImplementation(async (args: { where: { id?: string } }) =>
      args.where.id === ADMIN_HOPITAL.userId
        ? { idStructure: 'hopital-1', structure: { type: 'CHU' } }
        : null,
    );

    const result = await creerPharmacieAvecPharmacien(ADMIN_HOPITAL, DTO);

    expect(prisma.structureSante.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'PHARMACIE',
        idStructureParente: 'hopital-1',
      }),
    });
    expect(prisma.utilisateur.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ idStructure: 'pharmacie-1', role: 'PHARMACIEN' }),
    });
    expect(prisma.pharmacienProfile.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        idUtilisateur: 'pharmacien-1',
        idStructure: 'pharmacie-1',
        roleOfficine: 'TITULAIRE',
      }),
    });
    expect(result.structure).toEqual({ id: 'pharmacie-1', type: 'PHARMACIE' });
  });

  it('refuse à un administrateur hospitalier de choisir un autre parent', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue({
      idStructure: 'hopital-1',
      structure: { type: 'CHU' },
    });

    await expect(creerPharmacieAvecPharmacien(ADMIN_HOPITAL, {
      ...DTO,
      idStructureParente: 'hopital-2',
    })).rejects.toBeInstanceOf(ForbiddenError);
    expect(prisma.structureSante.create).not.toHaveBeenCalled();
  });

  it('refuse la création depuis une structure qui n’est pas un hôpital', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue({
      idStructure: 'centre-1',
      structure: { type: 'CENTRE' },
    });

    await expect(creerPharmacieAvecPharmacien(ADMIN_HOPITAL, DTO))
      .rejects.toBeInstanceOf(ForbiddenError);
    expect(prisma.structureSante.create).not.toHaveBeenCalled();
  });

  it('permet au super-admin de créer une pharmacie indépendante', async () => {
    const result = await creerPharmacieAvecPharmacien(SUPER_ADMIN, DTO);

    expect(prisma.structureSante.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: 'PHARMACIE', idStructureParente: null }),
    });
    expect(result.structure.id).toBe('pharmacie-1');
  });

  it('vérifie que le parent fourni par le super-admin est hospitalier', async () => {
    prisma.structureSante.findUnique.mockResolvedValue({ id: 'pharmacie-parent', type: 'PHARMACIE' });

    await expect(creerPharmacieAvecPharmacien(SUPER_ADMIN, {
      ...DTO,
      idStructureParente: 'pharmacie-parent',
    })).rejects.toBeInstanceOf(ValidationError);
    expect(prisma.structureSante.create).not.toHaveBeenCalled();
  });

  it('signale un parent inexistant', async () => {
    prisma.structureSante.findUnique.mockResolvedValue(null);

    await expect(creerPharmacieAvecPharmacien(SUPER_ADMIN, {
      ...DTO,
      idStructureParente: 'inconnu',
    })).rejects.toBeInstanceOf(NotFoundError);
  });

  it('empêche un administrateur hospitalier de créer un pharmacien directement sous l’hôpital', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue({
      idStructure: 'hopital-1',
      structure: { type: 'CHU' },
    });

    await expect(creerAgent('admin-h-1', {
      telephone: '+224620000002',
      prenom: 'Mamadou',
      nom: 'Bah',
      role: 'PHARMACIEN',
    })).rejects.toBeInstanceOf(ForbiddenError);
  });
});

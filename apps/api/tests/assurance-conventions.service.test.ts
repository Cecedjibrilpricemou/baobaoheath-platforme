import {
  ajouterConventionAssureur,
  configurationCatalogueAssureurs,
  conventionsDeLaStructure,
  retirerConventionAssureur,
} from '../src/services/assurance.service';
import type { JwtPayload } from '../src/types/auth.types';
import { ForbiddenError } from '../src/utils/app-error';

jest.mock('../src/config/prisma', () => ({
  prisma: {
    utilisateur: { findUnique: jest.fn() },
    assureur: { findUnique: jest.fn(), findMany: jest.fn() },
    structureAssureur: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));
jest.mock('../src/config/redis', () => ({ getRedis: () => null }));

type Mock = jest.Mock;
const { prisma } = jest.requireMock('../src/config/prisma') as {
  prisma: {
    utilisateur: { findUnique: Mock };
    assureur: { findUnique: Mock; findMany: Mock };
    structureAssureur: {
      findFirst: Mock;
      findMany: Mock;
      upsert: Mock;
      deleteMany: Mock;
    };
  };
};

const ADMIN_HOPITAL = { userId: 'admin-hopital', role: 'ADMIN_STRUCTURE' } as JwtPayload;
const TITULAIRE = { userId: 'titulaire', role: 'PHARMACIEN' } as JwtPayload;

beforeEach(() => {
  jest.resetAllMocks();
  prisma.assureur.findUnique.mockResolvedValue({ id: 'assureur-1', estActif: true });
  prisma.assureur.findMany.mockResolvedValue([]);
  prisma.structureAssureur.findMany.mockResolvedValue([]);
});

describe('conventions d assurance par structure', () => {
  it('permet a l admin hospitalier de configurer les conventions de son hopital', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue({
      idStructure: 'hopital-1',
      structure: { type: 'CHU', idStructureParente: null },
      pharmacienProfile: null,
    });

    await ajouterConventionAssureur(ADMIN_HOPITAL, 'assureur-1');

    expect(prisma.structureAssureur.upsert).toHaveBeenCalledWith({
      where: { idStructure_idAssureur: { idStructure: 'hopital-1', idAssureur: 'assureur-1' } },
      create: { idStructure: 'hopital-1', idAssureur: 'assureur-1' },
      update: {},
    });
  });

  it('refuse qu un titulaire modifie les conventions heritees d une pharmacie hospitaliere', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue({
      idStructure: 'pharmacie-1',
      structure: { type: 'PHARMACIE', idStructureParente: 'hopital-1' },
      pharmacienProfile: { roleOfficine: 'TITULAIRE' },
    });

    await expect(ajouterConventionAssureur(TITULAIRE, 'assureur-1')).rejects.toBeInstanceOf(ForbiddenError);
    expect(prisma.structureAssureur.upsert).not.toHaveBeenCalled();
  });

  it('permet au titulaire d une pharmacie independante de retirer une convention locale', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue({
      idStructure: 'pharmacie-independante',
      structure: { type: 'PHARMACIE', idStructureParente: null },
      pharmacienProfile: { roleOfficine: 'TITULAIRE' },
    });

    await retirerConventionAssureur(TITULAIRE, 'assureur-1');

    expect(prisma.structureAssureur.deleteMany).toHaveBeenCalledWith({
      where: { idStructure: 'pharmacie-independante', idAssureur: 'assureur-1' },
    });
  });

  it('refuse aux adjoints de modifier les conventions d une pharmacie independante', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue({
      idStructure: 'pharmacie-independante',
      structure: { type: 'PHARMACIE', idStructureParente: null },
      pharmacienProfile: { roleOfficine: 'ADJOINT' },
    });

    await expect(ajouterConventionAssureur(TITULAIRE, 'assureur-1')).rejects.toBeInstanceOf(ForbiddenError);
    expect(prisma.structureAssureur.upsert).not.toHaveBeenCalled();
  });

  it('marque les conventions de l hopital comme heritees dans la pharmacie fille', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue({
      idStructure: 'pharmacie-1',
      structure: { type: 'PHARMACIE', idStructureParente: 'hopital-1' },
      pharmacienProfile: { roleOfficine: 'TITULAIRE' },
    });
    prisma.structureAssureur.findMany.mockResolvedValue([{
      idStructure: 'hopital-1',
      idAssureur: 'assureur-1',
      assureur: {
        id: 'assureur-1', nom: 'Mutuelle A', code: 'MA', telephone: null, email: null,
        estActif: true, modeEchange: 'MANUEL', regles: [], _count: { contrats: 2 },
      },
      structure: { id: 'hopital-1' },
    }]);

    const assureurs = await conventionsDeLaStructure(TITULAIRE);

    expect(assureurs).toHaveLength(1);
    expect(assureurs[0]?.conventionHeritee).toBe(true);
    expect(assureurs[0]?.nom).toBe('Mutuelle A');
  });

  it('ne rend la configuration modifiable qu au titulaire independant ou a l admin hospitalier', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue({
      idStructure: 'pharmacie-1',
      structure: { type: 'PHARMACIE', idStructureParente: 'hopital-1' },
      pharmacienProfile: { roleOfficine: 'TITULAIRE' },
    });

    const configuration = await configurationCatalogueAssureurs(TITULAIRE);

    expect(configuration.conventionsModifiables).toBe(false);
    expect(configuration.conventionsHeritees).toBe(true);
  });
});

import { maStructure } from '../src/services/admin-structure.service';
import { ForbiddenError } from '../src/utils/app-error';

jest.mock('../src/config/prisma', () => ({
  prisma: { utilisateur: { findUnique: jest.fn() } },
}));
jest.mock('../src/utils/password.utils', () => ({ hashPassword: jest.fn() }));
jest.mock('../src/services/email.service', () => ({
  envoyerEmailAdminStructure: jest.fn(),
  envoyerEmailAgent: jest.fn(),
}));

const { prisma } = jest.requireMock('../src/config/prisma') as {
  prisma: { utilisateur: { findUnique: jest.Mock } };
};

/**
 * Ce que le menu de l'admin de structure doit savoir, et rien de plus.
 *
 * Le menu lisait le type de structure dans `/stats`, qui compte agents,
 * consultations et patients : quand ce calcul echouait, les entrees
 * Pharmacies et Assurances disparaissaient. Cette lecture-ci ne touche qu'une
 * ligne.
 */
describe('maStructure', () => {
  beforeEach(() => jest.clearAllMocks());

  it('dit qu\'un CHU est hospitalier', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue({
      idStructure: 's1', structure: { id: 's1', nom: 'CHU Donka', type: 'CHU' },
    });
    await expect(maStructure('u1')).resolves.toEqual({ id: 's1', nom: 'CHU Donka', type: 'CHU', hospitaliere: true });
  });

  it('dit qu\'une pharmacie ne l\'est pas', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue({
      idStructure: 's2', structure: { id: 's2', nom: 'Pharmacie du Port', type: 'PHARMACIE' },
    });
    await expect(maStructure('u2')).resolves.toMatchObject({ hospitaliere: false });
  });

  it('refuse un administrateur sans structure', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue({ idStructure: null, structure: null });
    await expect(maStructure('u3')).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('ne lit qu\'une ligne, sans compter quoi que ce soit', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue({
      idStructure: 's1', structure: { id: 's1', nom: 'CHU Donka', type: 'CHU' },
    });
    await maStructure('u1');
    expect(prisma.utilisateur.findUnique).toHaveBeenCalledTimes(1);
  });
});

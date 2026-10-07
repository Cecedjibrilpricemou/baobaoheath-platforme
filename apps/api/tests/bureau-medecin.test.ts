// Le bureau d'un médecin (EF-03).
//
// **Où le patient doit se rendre**, lu par l'accueil juste après l'avoir
// pointé. Facultatif : beaucoup d'hôpitaux ne numérotent pas leurs bureaux et
// l'agent accompagne à pied — c'est le cas décrit par l'utilisateur après deux
// séjours en hôpital.

jest.mock('../src/config/prisma', () => ({
  prisma: {
    utilisateur: { findUnique: jest.fn() },
    medecinProfile: { findUnique: jest.fn(), update: jest.fn() },
  },
}));
jest.mock('../src/config/redis', () => ({ getRedis: () => null }));
jest.mock('../src/services/email.service', () => ({
  envoyerEmailAdminStructure: jest.fn(), envoyerEmailAgent: jest.fn(),
}));

type M = jest.Mock;
const { prisma } = jest.requireMock('../src/config/prisma') as {
  prisma: {
    utilisateur: { findUnique: M };
    medecinProfile: { findUnique: M; update: M };
  };
};

import { definirBureau } from '../src/services/admin-structure.service';

const ADMIN = { userId: 'u-admin', role: 'ADMIN_STRUCTURE' } as never;
const PROFIL = {
  id: 'mp-1',
  idStructure: 's-1',
  utilisateur: { prenom: 'David', nom: 'Camara' },
};

beforeEach(() => {
  jest.resetAllMocks();
  prisma.utilisateur.findUnique.mockResolvedValue({ idStructure: 's-1' });
  prisma.medecinProfile.findUnique.mockResolvedValue(PROFIL);
  prisma.medecinProfile.update.mockResolvedValue({});
});

describe('definirBureau', () => {
  it('enregistre le bureau, sans ses espaces', async () => {
    const r = await definirBureau(ADMIN, 'u-doc', '  Bâtiment B, bureau 12  ');
    const [args] = prisma.medecinProfile.update.mock.calls[0] as [{ data: { bureau: string | null } }];
    expect(args.data.bureau).toBe('Bâtiment B, bureau 12');
    expect(r.bureau).toBe('Bâtiment B, bureau 12');
  });

  // **Le cas de l'hôpital sans numérotation.** Effacer doit être possible :
  // sinon un bureau saisi par erreur reste affiché, et le patient y va.
  it.each([null, '', '   '])('efface le bureau quand on envoie %p', async (valeur) => {
    const r = await definirBureau(ADMIN, 'u-doc', valeur);
    const [args] = prisma.medecinProfile.update.mock.calls[0] as [{ data: { bureau: string | null } }];
    expect(args.data.bureau).toBeNull();
    expect(r.bureau).toBeNull();
  });

  // **La règle qui compte** : un administrateur ne touche qu'aux médecins de
  // sa structure. Sans elle, l'admin d'un hôpital pourrait déplacer le bureau
  // d'un médecin d'un autre hôpital, et envoyer ses patients au mauvais endroit.
  it('refuse un médecin d une autre structure', async () => {
    prisma.medecinProfile.findUnique.mockResolvedValue({ ...PROFIL, idStructure: 's-2' });
    await expect(definirBureau(ADMIN, 'u-doc', 'B12')).rejects.toThrow(/introuvable/i);
    expect(prisma.medecinProfile.update).not.toHaveBeenCalled();
  });

  it('refuse un compte qui n est pas médecin', async () => {
    prisma.medecinProfile.findUnique.mockResolvedValue(null);
    await expect(definirBureau(ADMIN, 'u-accueil', 'B12')).rejects.toThrow(/introuvable/i);
    expect(prisma.medecinProfile.update).not.toHaveBeenCalled();
  });

  it('refuse un administrateur sans structure', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue({ idStructure: null });
    await expect(definirBureau(ADMIN, 'u-doc', 'B12')).rejects.toThrow(/structure/i);
    expect(prisma.medecinProfile.update).not.toHaveBeenCalled();
  });
});

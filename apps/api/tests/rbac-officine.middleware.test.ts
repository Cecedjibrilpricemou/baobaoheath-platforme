import { ForbiddenError } from '../src/utils/app-error';

jest.mock('../src/config/prisma', () => ({
  prisma: {
    pharmacienProfile: { findUnique: jest.fn() },
  },
}));

process.env['JWT_SECRET'] ??= 'test-secret-au-moins-seize-caracteres';
process.env['JWT_REFRESH_SECRET'] ??= 'test-refresh-au-moins-seize-caracteres';
process.env['DB_ENCRYPTION_KEY'] ??= '0'.repeat(64);
process.env['DATABASE_URL'] ??= 'postgresql://127.0.0.1:5432/test';

const { prisma } = jest.requireMock('../src/config/prisma') as {
  prisma: { pharmacienProfile: { findUnique: jest.Mock } };
};
const { requireOfficineRole } = require('../src/middlewares/rbac.middleware') as typeof import('../src/middlewares/rbac.middleware');

function requete(userId = 'user-1') {
  return { user: { userId } } as Parameters<ReturnType<typeof requireOfficineRole>>[0];
}

describe('requireOfficineRole', () => {
  beforeEach(() => jest.resetAllMocks());

  it('applique une permission temporaire non expiree', async () => {
    prisma.pharmacienProfile.findUnique.mockResolvedValue({
      roleOfficine: 'CAISSIER',
      roleOfficineTemporaire: 'PREPARATEUR',
      roleOfficineExpireLe: new Date(Date.now() + 60_000),
    });
    const next = jest.fn();

    await requireOfficineRole('PREPARATEUR')(requete(), {} as never, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('redevient au role permanent apres expiration', async () => {
    prisma.pharmacienProfile.findUnique.mockResolvedValue({
      roleOfficine: 'CAISSIER',
      roleOfficineTemporaire: 'PREPARATEUR',
      roleOfficineExpireLe: new Date(Date.now() - 60_000),
    });
    const next = jest.fn();

    await requireOfficineRole('PREPARATEUR')(requete(), {} as never, next);

    expect(next.mock.calls[0]?.[0]).toBeInstanceOf(ForbiddenError);
  });

  it('refuse un compte sans profil d officine', async () => {
    prisma.pharmacienProfile.findUnique.mockResolvedValue(null);
    const next = jest.fn();

    await requireOfficineRole('TITULAIRE')(requete(), {} as never, next);

    expect(next.mock.calls[0]?.[0]).toBeInstanceOf(ForbiddenError);
  });
});

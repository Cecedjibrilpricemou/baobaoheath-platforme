import { login, verifyLoginOtp, logout, register } from '../src/services/auth.service';
import { ConflictError, UnauthorizedError, ValidationError } from '../src/utils/app-error';
import { createHmac } from 'crypto';

jest.mock('../src/config/prisma', () => ({
  prisma: {
    utilisateur: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    patientProfile: { create: jest.fn() },
    session: { create: jest.fn(), deleteMany: jest.fn(), delete: jest.fn(), findUnique: jest.fn() },
    evenementConnexion: { create: jest.fn() },
    authOtp: {
      findFirst: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('../src/services/email.service', () => ({
  envoyerOtpConnexion: jest.fn().mockResolvedValue(undefined),
  envoyerEmailResetMotDePasse: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/utils/jwt.utils', () => ({
  generateTokenPair: jest.fn(),
  verifyToken: jest.fn(),
}));

// register() initialise les consentements de soins dans la transaction ;
// l'effet est couvert par privacy-consentements-defaut.test.ts.
jest.mock('../src/services/privacy.service', () => ({
  initialiserConsentementsParDefaut: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/utils/password.utils', () => ({
  hashPassword: jest.fn().mockResolvedValue('$hashed'),
  verifyPassword: jest.fn(),
}));

const { prisma } = jest.requireMock('../src/config/prisma') as {
  prisma: {
    utilisateur: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    patientProfile: { create: jest.Mock };
    session: { create: jest.Mock; deleteMany: jest.Mock; delete: jest.Mock; findUnique: jest.Mock };
    evenementConnexion: { create: jest.Mock };
    authOtp: {
      findFirst: jest.Mock;
      create: jest.Mock;
      deleteMany: jest.Mock;
      update: jest.Mock;
    };
    $transaction: jest.Mock;
  };
};

const { verifyPassword } = jest.requireMock('../src/utils/password.utils') as {
  verifyPassword: jest.Mock;
  hashPassword: jest.Mock;
};

const { generateTokenPair } = jest.requireMock('../src/utils/jwt.utils') as {
  generateTokenPair: jest.Mock;
};

const TOKEN_PAIR = { accessToken: 'mock-access', refreshToken: 'mock-refresh' };

beforeEach(() => {
  generateTokenPair.mockReturnValue(TOKEN_PAIR);
  prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(prisma));
});

afterEach(() => jest.resetAllMocks());

// ── login ─────────────────────────────────────────────────────────────────────
describe('login', () => {
  it('PATIENT gets tokens directly without OTP', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue({
      id: 'user-1',
      role: 'PATIENT',
      email: null,
      estActif: true,
      motDePasseHash: '$hashed',
    });
    verifyPassword.mockResolvedValue(true);
    prisma.session.create.mockResolvedValue({});
    prisma.utilisateur.update.mockResolvedValue({});

    const result = await login({ identifiant: '620000001', motDePasse: 'secret' });

    expect(result).toHaveProperty('accessToken');
    expect(result).toHaveProperty('refreshToken');
  });

  it('LIVREUR gets tokens with phone and password directly without OTP', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue({
      id: 'livreur-1',
      role: 'LIVREUR',
      email: null,
      estActif: true,
      motDePasseHash: '$hashed',
    });
    verifyPassword.mockResolvedValue(true);
    prisma.session.create.mockResolvedValue({});
    prisma.utilisateur.update.mockResolvedValue({});

    const result = await login({ identifiant: '620000001', motDePasse: 'secret' });

    expect(result).toHaveProperty('accessToken');
    expect(result).toHaveProperty('refreshToken');
    expect(prisma.authOtp.create).not.toHaveBeenCalled();
  });

  it('LIVREUR with a wrong password is still refused', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue({
      id: 'livreur-1',
      role: 'LIVREUR',
      email: null,
      estActif: true,
      motDePasseHash: '$hashed',
    });
    verifyPassword.mockResolvedValue(false);

    await expect(login({ identifiant: '620000001', motDePasse: 'wrong' }))
      .rejects.toBeInstanceOf(UnauthorizedError);
    expect(prisma.session.create).not.toHaveBeenCalled();
  });

  it('non-PATIENT staff gets OTP challenge', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue({
      id: 'doc-1',
      role: 'MEDECIN',
      email: 'doc@baobaoheath.gn',
      estActif: true,
      prenom: 'Docteur',
      nom: 'Test',
      motDePasseHash: '$hashed',
    });
    verifyPassword.mockResolvedValue(true);
    prisma.authOtp.deleteMany.mockResolvedValue({});
    prisma.authOtp.create.mockResolvedValue({ id: 'otp-1' });

    const result = await login({ identifiant: 'doc@baobaoheath.gn', motDePasse: 'secret' });

    expect(result).toHaveProperty('requiresOtp', true);
  });

  it('throws UnauthorizedError for wrong password', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue({
      id: 'user-1',
      role: 'PATIENT',
      estActif: true,
      motDePasseHash: '$hashed',
    });
    verifyPassword.mockResolvedValue(false);

    await expect(
      login({ identifiant: '620000001', motDePasse: 'wrong' })
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('throws UnauthorizedError for inactive account', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue({
      id: 'user-1',
      role: 'PATIENT',
      estActif: false,
      motDePasseHash: '$hashed',
    });

    await expect(
      login({ identifiant: '620000001', motDePasse: 'secret' })
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('throws UnauthorizedError for unknown user', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue(null);

    await expect(
      login({ identifiant: 'nobody@example.com', motDePasse: 'secret' })
    ).rejects.toBeInstanceOf(UnauthorizedError);
    expect(prisma.evenementConnexion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'ECHEC_AUTHENTIFICATION',
        idUtilisateur: null,
        idStructure: null,
        identifiantHash: createHmac('sha256', process.env['JWT_SECRET']!)
          .update('connection-identifier-v1:')
          .update('nobody@example.com')
          .digest('hex'),
      }),
    });
  });

  it('throws ValidationError when staff tries to login with a phone number', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue({
      id: 'asc-1',
      role: 'ASC',
      email: 'asc@baobaoheath.gn',
      estActif: true,
      motDePasseHash: '$hashed',
    });
    verifyPassword.mockResolvedValue(true);

    await expect(
      login({ identifiant: '620000001', motDePasse: 'secret' })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('MEDECIN still cannot login with a phone number', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue({
      id: 'medecin-1',
      role: 'MEDECIN',
      email: 'medecin@baobaoheath.gn',
      estActif: true,
      motDePasseHash: '$hashed',
    });
    verifyPassword.mockResolvedValue(true);

    await expect(login({ identifiant: '620000001', motDePasse: 'secret' }))
      .rejects.toBeInstanceOf(ValidationError);
    expect(prisma.authOtp.create).not.toHaveBeenCalled();
  });
});

// ── verifyLoginOtp ────────────────────────────────────────────────────────────
describe('verifyLoginOtp', () => {
  const baseUser = {
    id: 'doc-1',
    role: 'PHARMACIEN',
    email: 'doc@baobaoheath.gn',
    idStructure: 'pharmacie-1',
    estActif: true,
    prenom: 'D',
    nom: 'Test',
  };

  const validOtp = {
    id: 'otp-1',
    codeHash: '$hashed',
    expireLe: new Date(Date.now() + 10 * 60_000),
    tentatives: 0,
    maxTentatives: 5,
  };

  it('returns tokens for a valid OTP', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue(baseUser);
    prisma.authOtp.findFirst.mockResolvedValue(validOtp);
    verifyPassword.mockResolvedValue(true);
    prisma.authOtp.update.mockResolvedValue({});
    prisma.session.create.mockResolvedValue({});
    prisma.utilisateur.update.mockResolvedValue({});

    const result = await verifyLoginOtp(
      { email: 'doc@baobaoheath.gn', code: '123456' },
      { ipAdresse: '192.0.2.10', userAgent: 'test-agent' },
    );

    expect(result).toHaveProperty('accessToken');
    expect(prisma.session.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ ipAdresse: '192.0.2.10', userAgent: 'test-agent' }),
    }));
    expect(prisma.evenementConnexion.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        type: 'CONNEXION_REUSSIE',
        idUtilisateur: 'doc-1',
        idStructure: 'pharmacie-1',
        ipAdresse: '192.0.2.10',
        userAgent: 'test-agent',
      }),
    }));
  });

  it('throws ValidationError for expired OTP', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue(baseUser);
    prisma.authOtp.findFirst.mockResolvedValue({
      ...validOtp,
      expireLe: new Date(Date.now() - 1000),
    });
    prisma.authOtp.update.mockResolvedValue({});

    await expect(
      verifyLoginOtp({ email: 'doc@baobaoheath.gn', code: '000000' })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError for max attempts reached', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue(baseUser);
    prisma.authOtp.findFirst.mockResolvedValue({
      ...validOtp,
      tentatives: 5,
      maxTentatives: 5,
    });

    await expect(
      verifyLoginOtp({ email: 'doc@baobaoheath.gn', code: '999999' })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError for wrong OTP and decrements remaining attempts', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue(baseUser);
    prisma.authOtp.findFirst.mockResolvedValue({ ...validOtp, tentatives: 2 });
    verifyPassword.mockResolvedValue(false);
    prisma.authOtp.update.mockResolvedValue({});

    await expect(
      verifyLoginOtp({ email: 'doc@baobaoheath.gn', code: 'wrong1' })
    ).rejects.toBeInstanceOf(ValidationError);

    expect(prisma.authOtp.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tentatives: 3 }) })
    );
  });

  it('throws ValidationError when PATIENT attempts OTP verification', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue({ ...baseUser, role: 'PATIENT' });

    await expect(
      verifyLoginOtp({ email: 'patient@example.com', code: '123456' })
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

// ── logout ────────────────────────────────────────────────────────────────────
describe('logout', () => {
  it('deletes the session', async () => {
    prisma.session.deleteMany.mockResolvedValue({ count: 1 });

    await logout('sess-1');

    expect(prisma.session.deleteMany).toHaveBeenCalledWith({ where: { id: 'sess-1' } });
  });
});

// ── register ──────────────────────────────────────────────────────────────────
describe('register', () => {
  it('throws ConflictError when phone already used', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue({ id: 'existing' });

    await expect(
      register({
        telephone: '620000001',
        motDePasse: 'secret',
        prenom: 'Test',
        nom: 'User',
      })
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('creates user and patient profile via transaction', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue(null);

    const mockUser = { id: 'new-user', role: 'PATIENT' };
    prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const mockTx = {
        utilisateur: {
          create: jest.fn().mockResolvedValue(mockUser),
          update: jest.fn().mockResolvedValue({}),
        },
        patientProfile: { create: jest.fn().mockResolvedValue({ id: 'new-patient' }) },
        session: { create: jest.fn().mockResolvedValue({}) },
        evenementConnexion: { create: jest.fn().mockResolvedValue({}) },
      };
      return fn(mockTx);
    });
    prisma.session.create.mockResolvedValue({});
    prisma.utilisateur.update.mockResolvedValue({});

    const result = await register({
      telephone: '620000001',
      motDePasse: 'secret',
      prenom: 'Test',
      nom: 'User',
    });

    expect(result).toHaveProperty('accessToken');
  });
});

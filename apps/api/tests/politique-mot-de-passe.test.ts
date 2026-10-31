// La longueur minimale des mots de passe.
//
// **Le constat (revue du 30/10).** Six caracteres pour tous les comptes, y
// compris ceux qui ouvrent des dossiers medicaux, la caisse d'une officine ou
// l'administration nationale. Et le mot de passe temporaire d'un professionnel
// commencait toujours par le meme prefixe public, suivi de cinq caracteres
// aleatoires : environ 29 bits, devinable.
//
// La regle : 12 caracteres pour tout compte professionnel ou administrateur,
// 6 pour un patient — le patient tape sur un telephone, souvent un mot de
// passe remis au comptoir, et n'ouvre que son propre dossier.
import { readFileSync } from 'fs';
import { join } from 'path';

jest.mock('../src/config/prisma', () => ({
  prisma: {
    utilisateur: { findUnique: jest.fn(), update: jest.fn() },
    motDePasseReset: { findUnique: jest.fn(), update: jest.fn() },
    session: { deleteMany: jest.fn() },
    $transaction: jest.fn(),
  },
}));
jest.mock('../src/config/redis', () => ({ getRedis: () => null }));
jest.mock('../src/services/email.service', () => ({
  envoyerOtpConnexion: jest.fn(), envoyerEmailResetMotDePasse: jest.fn(),
}));
jest.mock('../src/services/privacy.service', () => ({ initialiserConsentementsParDefaut: jest.fn() }));
jest.mock('../src/utils/password.utils', () => ({
  hashPassword: jest.fn().mockResolvedValue('$hache'),
  verifyPassword: jest.fn().mockResolvedValue(true),
}));

import {
  LONGUEUR_MIN_PATIENT,
  LONGUEUR_MIN_PROFESSIONNEL,
  assertMotDePasseConforme,
  longueurMinimale,
} from '../src/utils/politique-mot-de-passe';
import { changerMotDePasse, reinitialiserMotDePasse } from '../src/services/auth.service';
import { genererMotDePasseTemp } from '../src/services/admin-structure.service';
import { ValidationError } from '../src/utils/app-error';

const { prisma } = jest.requireMock('../src/config/prisma') as {
  prisma: {
    utilisateur: { findUnique: jest.Mock; update: jest.Mock };
    motDePasseReset: { findUnique: jest.Mock; update: jest.Mock };
    session: { deleteMany: jest.Mock };
    $transaction: jest.Mock;
  };
};

beforeEach(() => {
  jest.clearAllMocks();
  prisma.$transaction.mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn(prisma));
});

const HUIT = 'abcd2345';
const DOUZE = 'abcdefgh2345';

describe('la regle', () => {
  it('12 caracteres pour tout compte professionnel ou administrateur', () => {
    for (const role of ['MEDECIN', 'PHARMACIEN', 'ASC', 'AGENT_ACCUEIL', 'TECHNICIEN_LABO', 'LIVREUR',
      'ADMIN_STRUCTURE', 'ADMIN_REGIONAL', 'ADMIN_NATIONAL', 'SUPER_ADMIN', 'ASSUREUR']) {
      expect(longueurMinimale(role)).toBe(LONGUEUR_MIN_PROFESSIONNEL);
    }
    expect(LONGUEUR_MIN_PROFESSIONNEL).toBeGreaterThanOrEqual(12);
  });

  it('6 caracteres pour un patient', () => {
    expect(longueurMinimale('PATIENT')).toBe(LONGUEUR_MIN_PATIENT);
    expect(LONGUEUR_MIN_PATIENT).toBe(6);
  });

  it('un role inconnu suit la regle la plus stricte', () => {
    expect(longueurMinimale('ROLE_FUTUR')).toBe(LONGUEUR_MIN_PROFESSIONNEL);
  });

  it('refuse avec un message qui donne la longueur attendue', () => {
    expect(() => assertMotDePasseConforme(HUIT, 'MEDECIN')).toThrow(ValidationError);
    expect(() => assertMotDePasseConforme(HUIT, 'MEDECIN')).toThrow(/12 caract/);
    expect(() => assertMotDePasseConforme(HUIT, 'PATIENT')).not.toThrow();
    expect(() => assertMotDePasseConforme(DOUZE, 'SUPER_ADMIN')).not.toThrow();
  });
});

describe('changerMotDePasse', () => {
  it('refuse 8 caracteres a un medecin', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue({ id: 'u', role: 'MEDECIN', doitChangerMotDePasse: true, motDePasseHash: 'h' });
    await expect(changerMotDePasse('u', { nouveauMotDePasse: HUIT })).rejects.toThrow(/12 caract/);
    expect(prisma.utilisateur.update).not.toHaveBeenCalled();
  });

  it('accepte 8 caracteres a un patient', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue({ id: 'u', role: 'PATIENT', doitChangerMotDePasse: true, motDePasseHash: 'h' });
    await changerMotDePasse('u', { nouveauMotDePasse: HUIT });
    expect(prisma.utilisateur.update).toHaveBeenCalled();
  });
});

describe('reinitialiserMotDePasse', () => {
  it('refuse 8 caracteres au compte d un administrateur', async () => {
    prisma.motDePasseReset.findUnique.mockResolvedValue({
      idUtilisateur: 'u', utiliseLe: null, expireLe: new Date(Date.now() + 60_000),
    });
    prisma.utilisateur.findUnique.mockResolvedValue({ id: 'u', role: 'ADMIN_NATIONAL' });
    await expect(reinitialiserMotDePasse({ token: 'x'.repeat(64), nouveauMotDePasse: HUIT })).rejects.toThrow(/12 caract/);
    expect(prisma.utilisateur.update).not.toHaveBeenCalled();
  });
});

describe('genererMotDePasseTemp (comptes professionnels)', () => {
  const echantillon = Array.from({ length: 500 }, () => genererMotDePasseTemp());

  it('respecte la regle des professionnels', () => {
    for (const mdp of echantillon) expect(() => assertMotDePasseConforme(mdp, 'MEDECIN')).not.toThrow();
  });

  it("n'a plus de prefixe fixe : aucun debut commun a tout l'echantillon", () => {
    const premiers = new Set(echantillon.map((m) => m.slice(0, 3)));
    expect(premiers.size).toBeGreaterThan(100);
  });

  it('au moins 16 caracteres aleatoires, sans caractere ambigu', () => {
    for (const mdp of echantillon) {
      expect(mdp.length).toBeGreaterThanOrEqual(16);
      expect(mdp).not.toMatch(/[O0Il1]/);
    }
  });
});

describe('creation de comptes professionnels avec un mot de passe choisi', () => {
  it.each([
    ['admin-structure.service.ts', 2],
    ['pharmacien.service.ts', 1],
  ])('%s verifie la regle avant de hacher un mot de passe fourni', (fichier, attendu) => {
    const source = readFileSync(join(__dirname, '..', 'src', 'services', fichier), 'utf8');
    const verifications = source.match(/if \(dto\.(?:pharmacien\.)?motDePasse\) assertMotDePasseConforme\(/g) ?? [];
    expect(verifications.length).toBe(attendu);
  });
});

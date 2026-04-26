import { prisma } from '../config/prisma';
import { hashPassword, verifyPassword } from '../utils/password.utils';
import { generateTokenPair } from '../utils/jwt.utils';
import { LoginDto, RegisterDto, TokenPair } from '../types/auth.types';
import { Role } from '../config/generated/client/client';
import { randomUUID } from 'crypto';

export async function register(dto: RegisterDto): Promise<TokenPair> {
  const existing = await prisma.utilisateur.findUnique({
    where: { telephone: dto.telephone },
  });

  if (existing) {
    throw new Error('Ce numéro de téléphone est déjà utilisé');
  }

  const motDePasseHash = await hashPassword(dto.motDePasse);

  const utilisateur = await prisma.$transaction(async (tx) => {
    const user = await tx.utilisateur.create({
      data: {
        telephone: dto.telephone,
        motDePasseHash,
        prenom: dto.prenom,
        nom: dto.nom,
        role: dto.role ?? Role.PATIENT,
      },
    });

    const role = dto.role ?? Role.PATIENT;

    if (role === Role.PATIENT) {
      await tx.patientProfile.create({
        data: {
          idUtilisateur: user.id,
          dateNaissance: new Date('2000-01-01'),
          sexe: 'M',
          prefecture: 'Conakry',
        },
      });
    }

    if (role === Role.ASC || role === Role.ASC_SUPERVISOR) {
      await tx.ascProfile.create({
        data: {
          idUtilisateur: user.id,
          prefecture: 'Conakry',
          zone: 'Zone par défaut',
        },
      });
    }

    if (role === Role.MEDECIN) {
      await tx.medecinProfile.create({
        data: {
          idUtilisateur: user.id,
          specialite: 'Médecine générale',
          numerOrdre: `ORD-${Date.now()}`,
        },
      });
    }

    return user;
  });

  const sessionId = randomUUID();

  const tokenPair = generateTokenPair({
    userId: utilisateur.id,
    role: utilisateur.role,
    sessionId,
  });

  await prisma.session.create({
    data: {
      id: sessionId,
      refreshToken: tokenPair.refreshToken,
      expireLe: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      idUtilisateur: utilisateur.id,
    },
  });

  return tokenPair;
}

export async function login(dto: LoginDto): Promise<TokenPair> {
  const utilisateur = await prisma.utilisateur.findUnique({
    where: { telephone: dto.telephone },
  });

  if (!utilisateur || !utilisateur.estActif) {
    throw new Error('Identifiants invalides');
  }

  const valid = await verifyPassword(dto.motDePasse, utilisateur.motDePasseHash);

  if (!valid) {
    throw new Error('Identifiants invalides');
  }

  const sessionId = randomUUID();

  const tokenPair = generateTokenPair({
    userId: utilisateur.id,
    role: utilisateur.role,
    sessionId,
  });

  await prisma.session.create({
    data: {
      id: sessionId,
      refreshToken: tokenPair.refreshToken,
      expireLe: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      idUtilisateur: utilisateur.id,
    },
  });

  await prisma.utilisateur.update({
    where: { id: utilisateur.id },
    data: { derniereConnexion: new Date() },
  });

  return tokenPair;
}

export async function logout(sessionId: string): Promise<void> {
  await prisma.session.deleteMany({
    where: { id: sessionId },
  });
}

export async function refreshTokens(refreshToken: string): Promise<TokenPair> {
  const session = await prisma.session.findUnique({
    where: { refreshToken },
    include: { utilisateur: true },
  });

  if (!session || session.expireLe < new Date()) {
    throw new Error('Session expirée ou invalide');
  }

  const sessionId = randomUUID();

  const tokenPair = generateTokenPair({
    userId: session.utilisateur.id,
    role: session.utilisateur.role,
    sessionId,
  });

  await prisma.session.delete({ where: { id: session.id } });

  await prisma.session.create({
    data: {
      id: sessionId,
      refreshToken: tokenPair.refreshToken,
      expireLe: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      idUtilisateur: session.utilisateur.id,
    },
  });

  return tokenPair;
}

export async function getMe(userId: string) {
  const utilisateur = await prisma.utilisateur.findUnique({
    where: { id: userId },
    select: {
      id: true,
      telephone: true,
      email: true,
      prenom: true,
      nom: true,
      role: true,
      langue: true,
      photoUrl: true,
      estActif: true,
      creeLe: true,
    },
  });

  if (!utilisateur) {
    throw new Error('Utilisateur non trouvé');
  }

  return utilisateur;
}

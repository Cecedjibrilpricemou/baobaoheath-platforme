import { prisma } from '../config/prisma';
import { hashPassword, verifyPassword } from '../utils/password.utils';
import { generateTokenPair } from '../utils/jwt.utils';
import { LoginDto, RegisterDto, TokenPair } from '../types/auth.types';
import { Role } from '../config/generated/client/client';
import { randomUUID } from 'crypto';

export async function register(dto: RegisterDto): Promise<TokenPair> {
  const existingTel = await prisma.utilisateur.findUnique({ where: { telephone: dto.telephone } });
  if (existingTel) throw new Error('Ce numéro de téléphone est déjà utilisé');

  if (dto.email) {
    const existingEmail = await prisma.utilisateur.findUnique({ where: { email: dto.email } });
    if (existingEmail) throw new Error('Cette adresse email est déjà utilisée');
  }

  const motDePasseHash = await hashPassword(dto.motDePasse);

  const utilisateur = await prisma.$transaction(async (tx) => {
    const user = await tx.utilisateur.create({
      data: {
        telephone: dto.telephone,
        email: dto.email ?? null,
        motDePasseHash,
        prenom: dto.prenom,
        nom: dto.nom,
        role: dto.role ?? Role.PATIENT,
      },
    });

    const role = dto.role ?? Role.PATIENT;

    if (role === Role.PATIENT) {
      await tx.patientProfile.create({
        data: { idUtilisateur: user.id, dateNaissance: new Date('2000-01-01'), sexe: 'M', prefecture: 'Conakry' },
      });
    }
    if (role === Role.ASC || role === Role.ASC_SUPERVISOR) {
      await tx.ascProfile.create({ data: { idUtilisateur: user.id } });
    }
    if (role === Role.MEDECIN) {
      await tx.medecinProfile.create({ data: { idUtilisateur: user.id, specialite: 'Médecine générale', numeroCom: `ORD-${Date.now()}` } });
    }
    if (role === Role.PHARMACIEN) {
      await tx.pharmacienProfile.create({ data: { idUtilisateur: user.id } });
    }

    return user;
  });

  const sessionId = randomUUID();
  const tokenPair = generateTokenPair({ userId: utilisateur.id, role: utilisateur.role, sessionId });
  await prisma.session.create({
    data: { id: sessionId, refreshToken: tokenPair.refreshToken, expireLe: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), idUtilisateur: utilisateur.id },
  });

  return tokenPair;
}

export async function login(dto: LoginDto): Promise<TokenPair> {
  const isEmail = dto.identifiant.includes('@');
  const utilisateur = await prisma.utilisateur.findUnique({
    where: isEmail ? { email: dto.identifiant } : { telephone: dto.identifiant },
  });

  if (!utilisateur || !utilisateur.estActif) throw new Error('Identifiants invalides');

  const valid = await verifyPassword(dto.motDePasse, utilisateur.motDePasseHash);
  if (!valid) throw new Error('Identifiants invalides');

  const sessionId = randomUUID();
  const tokenPair = generateTokenPair({ userId: utilisateur.id, role: utilisateur.role, sessionId });

  await prisma.session.create({
    data: { id: sessionId, refreshToken: tokenPair.refreshToken, expireLe: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), idUtilisateur: utilisateur.id },
  });
  await prisma.utilisateur.update({ where: { id: utilisateur.id }, data: { derniereConnexion: new Date() } });

  return tokenPair;
}

export async function logout(sessionId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { id: sessionId } });
}

export async function refreshTokens(refreshToken: string): Promise<TokenPair> {
  const session = await prisma.session.findUnique({ where: { refreshToken }, include: { utilisateur: true } });
  if (!session || session.expireLe < new Date()) throw new Error('Session expirée ou invalide');

  const sessionId = randomUUID();
  const tokenPair = generateTokenPair({ userId: session.utilisateur.id, role: session.utilisateur.role, sessionId });

  await prisma.session.delete({ where: { id: session.id } });
  await prisma.session.create({
    data: { id: sessionId, refreshToken: tokenPair.refreshToken, expireLe: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), idUtilisateur: session.utilisateur.id },
  });

  return tokenPair;
}

export async function getMe(userId: string) {
  const utilisateur = await prisma.utilisateur.findUnique({
    where: { id: userId },
    select: {
      id: true, telephone: true, email: true,
      prenom: true, nom: true, role: true,
      langue: true, photoUrl: true, estActif: true,
      doitChangerMotDePasse: true,
      creeLe: true, modifieLe: true,
    },
  });
  if (!utilisateur) throw new Error('Utilisateur non trouvé');
  return utilisateur;
}

// ── NOUVEAU : Changer le mot de passe ────────────────────────────
export async function changerMotDePasse(userId: string, dto: {
  ancienMotDePasse?: string;
  nouveauMotDePasse: string;
}): Promise<void> {
  const utilisateur = await prisma.utilisateur.findUnique({ where: { id: userId } });
  if (!utilisateur) throw new Error('Utilisateur non trouvé');

  // Si changement non forcé → vérifier l'ancien mot de passe
  if (!utilisateur.doitChangerMotDePasse) {
    if (!dto.ancienMotDePasse) throw new Error('L\'ancien mot de passe est obligatoire');
    const valid = await verifyPassword(dto.ancienMotDePasse, utilisateur.motDePasseHash);
    if (!valid) throw new Error('Ancien mot de passe incorrect');
  }

  if (dto.nouveauMotDePasse.length < 6) throw new Error('Le mot de passe doit contenir au moins 6 caractères');

  const motDePasseHash = await hashPassword(dto.nouveauMotDePasse);
  await prisma.utilisateur.update({
    where: { id: userId },
    data: { motDePasseHash, doitChangerMotDePasse: false }
  });
}

// ── NOUVEAU : Mettre à jour le profil ────────────────────────────
export async function updateProfil(userId: string, dto: {
  prenom?: string;
  nom?: string;
  email?: string;
  telephone?: string;
}): Promise<void> {
  if (dto.email) {
    const existing = await prisma.utilisateur.findFirst({ where: { email: dto.email, NOT: { id: userId } } });
    if (existing) throw new Error('Cette adresse email est déjà utilisée');
  }
  if (dto.telephone) {
    const existing = await prisma.utilisateur.findFirst({ where: { telephone: dto.telephone, NOT: { id: userId } } });
    if (existing) throw new Error('Ce numéro de téléphone est déjà utilisé');
  }

  await prisma.utilisateur.update({ where: { id: userId }, data: dto });
}
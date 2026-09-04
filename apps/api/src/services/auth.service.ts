import { randomBytes, randomInt, randomUUID, createHash } from 'crypto';
import { Role } from '../config/generated/client/client';
import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { ForgotPasswordDto, LoginDto, LoginResult, RegisterDto, ResetPasswordDto, TokenPair, VerifyLoginOtpDto } from '../types/auth.types';
import { generateTokenPair } from '../utils/jwt.utils';
import { hashPassword, verifyPassword } from '../utils/password.utils';
import { envoyerEmailResetMotDePasse, envoyerOtpConnexion } from './email.service';
import {
  AppError,
  ConflictError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../utils/app-error';
import { logger } from '../config/logger';

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;

function canUseDevOtpFallback(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.EMAIL_OTP_DEV_FALLBACK !== 'false';
}

async function createSessionTokens(utilisateur: { id: string; role: Role }): Promise<TokenPair> {
  const sessionId = randomUUID();
  const tokenPair = generateTokenPair({ userId: utilisateur.id, role: utilisateur.role, sessionId });

  await prisma.session.create({
    data: {
      id: sessionId,
      refreshToken: tokenPair.refreshToken,
      expireLe: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      idUtilisateur: utilisateur.id,
    },
  });

  await prisma.utilisateur.update({
    where: { id: utilisateur.id },
    data: { derniereConnexion: new Date() },
  });

  return tokenPair;
}

function generateOtpCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export async function register(dto: RegisterDto): Promise<TokenPair> {
  const existingTel = await prisma.utilisateur.findUnique({ where: { telephone: dto.telephone } });
  if (existingTel) throw new ConflictError('Ce numero de telephone est deja utilise');

  if (dto.email) {
    const existingEmail = await prisma.utilisateur.findUnique({ where: { email: dto.email } });
    if (existingEmail) throw new ConflictError('Cette adresse email est deja utilisee');
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
        role: Role.PATIENT,
      },
    });

    await tx.patientProfile.create({
      data: {
        idUtilisateur: user.id,
        dateNaissance: new Date('2000-01-01'),
        sexe: 'M',
        prefecture: 'Conakry',
      },
    });

    return user;
  });

  return createSessionTokens(utilisateur);
}

export async function login(dto: LoginDto): Promise<LoginResult> {
  const identifiant = dto.identifiant.trim();
  const isEmail = identifiant.includes('@');

  const utilisateur = await prisma.utilisateur.findUnique({
    where: isEmail ? { email: identifiant.toLowerCase() } : { telephone: identifiant },
  });

  if (!utilisateur || !utilisateur.estActif) throw new UnauthorizedError('Identifiants invalides');

  const valid = await verifyPassword(dto.motDePasse, utilisateur.motDePasseHash);
  if (!valid) throw new UnauthorizedError('Identifiants invalides');

  if (utilisateur.role === Role.PATIENT) {
    return createSessionTokens(utilisateur);
  }

  if (!isEmail) {
    throw new ValidationError('Les utilisateurs du systeme doivent se connecter avec leur email professionnel');
  }

  if (!utilisateur.email) {
    throw new ValidationError('Aucune adresse email n est associee a ce compte. Contactez un administrateur');
  }

  const code = generateOtpCode();
  const codeHash = await hashPassword(code);
  const expireLe = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  await prisma.authOtp.deleteMany({
    where: {
      idUtilisateur: utilisateur.id,
      OR: [
        { utiliseLe: { not: null } },
        { expireLe: { lt: new Date() } },
      ],
    },
  });

  const otp = await prisma.authOtp.create({
    data: {
      idUtilisateur: utilisateur.id,
      codeHash,
      expireLe,
      maxTentatives: OTP_MAX_ATTEMPTS,
    },
  });

  let devOtp: string | undefined;

  try {
    await envoyerOtpConnexion({
      destinataire: utilisateur.email,
      prenomNom: `${utilisateur.prenom} ${utilisateur.nom}`,
      code,
      expireDansMinutes: OTP_TTL_MINUTES,
    });
  } catch (error: unknown) {
    logger.error('[AUTH OTP] Envoi email echoue', {
      email: utilisateur.email,
      error: error instanceof Error ? error.message : error,
    });

    if (!canUseDevOtpFallback()) {
      await prisma.authOtp.deleteMany({ where: { id: otp.id } });
      throw new AppError("Mot de passe correct, mais l'envoi du code OTP a echoue. Verifiez l'email du compte ou reessayez", 503);
    }

    devOtp = code;
    logger.debug(`[AUTH OTP DEV] Code OTP pour ${utilisateur.email}: ${code}`);
  }

  return {
    requiresOtp: true,
    email: utilisateur.email,
    expiresInMinutes: OTP_TTL_MINUTES,
    message: devOtp
      ? "L'envoi email OTP a echoue. Mode developpement actif: utilisez le code affiche dans la console backend"
      : 'Un code OTP de 6 chiffres a ete envoye a votre adresse email',
    ...(devOtp ? { devOtp } : {}),
  };
}

export async function verifyLoginOtp(dto: VerifyLoginOtpDto): Promise<TokenPair> {
  const email = dto.email.trim().toLowerCase();
  const utilisateur = await prisma.utilisateur.findUnique({
    where: { email },
  });

  if (!utilisateur || !utilisateur.estActif) {
    throw new NotFoundError('Compte introuvable ou desactive');
  }

  if (utilisateur.role === Role.PATIENT) {
    throw new ValidationError('La verification OTP n est pas requise pour les patients');
  }

  const otp = await prisma.authOtp.findFirst({
    where: {
      idUtilisateur: utilisateur.id,
      utiliseLe: null,
    },
    orderBy: { creeLe: 'desc' },
  });

  if (!otp) {
    throw new ValidationError('Aucun code OTP actif. Veuillez relancer la connexion');
  }

  if (otp.expireLe < new Date()) {
    await prisma.authOtp.update({ where: { id: otp.id }, data: { utiliseLe: new Date() } });
    throw new ValidationError('Code OTP expire. Veuillez relancer la connexion');
  }

  if (otp.tentatives >= otp.maxTentatives) {
    throw new ValidationError('Nombre maximum de tentatives atteint. Veuillez relancer la connexion');
  }

  const isValid = await verifyPassword(dto.code, otp.codeHash);
  if (!isValid) {
    const nextAttempts = otp.tentatives + 1;
    await prisma.authOtp.update({
      where: { id: otp.id },
      data: {
        tentatives: nextAttempts,
        ...(nextAttempts >= otp.maxTentatives ? { utiliseLe: new Date() } : {}),
      },
    });

    const remaining = otp.maxTentatives - nextAttempts;
    if (remaining <= 0) {
      throw new ValidationError('Code OTP incorrect. Nombre maximum de tentatives atteint. Veuillez relancer la connexion');
    }

    throw new ValidationError(`Code OTP incorrect. Il vous reste ${remaining} tentative(s)`);
  }

  await prisma.authOtp.update({
    where: { id: otp.id },
    data: { utiliseLe: new Date() },
  });

  return createSessionTokens(utilisateur);
}

export async function logout(sessionId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { id: sessionId } });
}

export async function refreshTokens(refreshToken: string): Promise<TokenPair> {
  const session = await prisma.session.findUnique({
    where: { refreshToken },
    include: { utilisateur: true },
  });
  if (!session || session.expireLe < new Date()) throw new UnauthorizedError('Session expiree ou invalide');
  if (!session.utilisateur.estActif) throw new UnauthorizedError('Utilisateur desactive');

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
      expireLe: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
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
      doitChangerMotDePasse: true,
      creeLe: true,
      modifieLe: true,
    },
  });
  if (!utilisateur) throw new NotFoundError('Utilisateur non trouve');
  return utilisateur;
}

export async function changerMotDePasse(userId: string, dto: {
  ancienMotDePasse?: string;
  nouveauMotDePasse: string;
}): Promise<void> {
  const utilisateur = await prisma.utilisateur.findUnique({ where: { id: userId } });
  if (!utilisateur) throw new NotFoundError('Utilisateur non trouve');

  if (!utilisateur.doitChangerMotDePasse) {
    if (!dto.ancienMotDePasse) throw new ValidationError("L'ancien mot de passe est obligatoire");
    const valid = await verifyPassword(dto.ancienMotDePasse, utilisateur.motDePasseHash);
    if (!valid) throw new UnauthorizedError('Ancien mot de passe incorrect');
  }

  if (dto.nouveauMotDePasse.length < 6) {
    throw new ValidationError('Le mot de passe doit contenir au moins 6 caracteres');
  }

  const motDePasseHash = await hashPassword(dto.nouveauMotDePasse);
  await prisma.utilisateur.update({
    where: { id: userId },
    data: { motDePasseHash, doitChangerMotDePasse: false },
  });
}

const RESET_TOKEN_TTL_MINUTES = 60;

function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function demanderResetMotDePasse(dto: ForgotPasswordDto): Promise<void> {
  const utilisateur = await prisma.utilisateur.findUnique({
    where: { email: dto.email.toLowerCase() },
  });

  // Ne jamais révéler si l'email existe — retourner silencieusement
  if (!utilisateur || !utilisateur.estActif || !utilisateur.email) return;

  // Supprimer les anciens tokens de reset pour cet utilisateur
  await prisma.motDePasseReset.deleteMany({ where: { idUtilisateur: utilisateur.id } });

  const token     = randomBytes(32).toString('hex');
  const tokenHash = hashResetToken(token);
  const expireLe  = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);

  await prisma.motDePasseReset.create({
    data: { idUtilisateur: utilisateur.id, tokenHash, expireLe },
  });

  const lienReset = `${env.FRONTEND_URL}/auth/reset-password?token=${token}`;

  try {
    await envoyerEmailResetMotDePasse({
      destinataire:       utilisateur.email,
      prenomNom:          `${utilisateur.prenom} ${utilisateur.nom}`,
      lienReset,
      expireDansMinutes:  RESET_TOKEN_TTL_MINUTES,
    });
  } catch (error: unknown) {
    logger.error('[RESET PWD] Envoi email echoue', {
      email: utilisateur.email,
      error: error instanceof Error ? error.message : error,
    });
    // On ne re-throw pas — on ne veut pas révéler l'échec à l'appelant
  }
}

export async function reinitialiserMotDePasse(dto: ResetPasswordDto): Promise<void> {
  const tokenHash = hashResetToken(dto.token);

  const resetRecord = await prisma.motDePasseReset.findUnique({ where: { tokenHash } });

  if (!resetRecord || resetRecord.utiliseLe !== null) {
    throw new ValidationError('Lien de réinitialisation invalide ou déjà utilisé');
  }

  if (resetRecord.expireLe < new Date()) {
    throw new ValidationError('Lien de réinitialisation expiré. Veuillez en faire un nouveau.');
  }

  if (dto.nouveauMotDePasse.length < 6) {
    throw new ValidationError('Le mot de passe doit contenir au moins 6 caractères');
  }

  const motDePasseHash = await hashPassword(dto.nouveauMotDePasse);

  await prisma.$transaction(async (tx) => {
    await tx.utilisateur.update({
      where: { id: resetRecord.idUtilisateur },
      data: { motDePasseHash, doitChangerMotDePasse: false },
    });

    await tx.motDePasseReset.update({
      where: { id: resetRecord.id },
      data: { utiliseLe: new Date() },
    });

    // Invalider toutes les sessions actives (forcer re-connexion)
    await tx.session.deleteMany({ where: { idUtilisateur: resetRecord.idUtilisateur } });
  });
}

export async function updateProfil(userId: string, dto: {
  prenom?: string;
  nom?: string;
  email?: string;
  telephone?: string;
  photoUrl?: string;
}): Promise<void> {
  if (dto.email) {
    const existing = await prisma.utilisateur.findFirst({
      where: { email: dto.email, NOT: { id: userId } },
    });
    if (existing) throw new ConflictError('Cette adresse email est deja utilisee');
  }
  if (dto.telephone) {
    const existing = await prisma.utilisateur.findFirst({
      where: { telephone: dto.telephone, NOT: { id: userId } },
    });
    if (existing) throw new ConflictError('Ce numero de telephone est deja utilise');
  }

  await prisma.utilisateur.update({ where: { id: userId }, data: dto });
}

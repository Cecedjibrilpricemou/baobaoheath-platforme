import { Role } from '../config/generated/client/client';

export interface JwtPayload {
  userId: string;
  role: Role;
  sessionId: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

// Connexion par téléphone OU email
export interface LoginDto {
  identifiant: string; // téléphone ou email
  motDePasse: string;
}

// Inscription — téléphone obligatoire, email optionnel
export interface RegisterDto {
  telephone: string;
  email?: string;        // ← NOUVEAU optionnel
  motDePasse: string;
  prenom: string;
  nom: string;
  role?: Role;
}

export interface OtpRequestDto {
  telephone: string;
}

export interface OtpVerifyDto {
  telephone: string;
  code: string;
}

export interface AuthenticatedRequest extends Express.Request {
  user: JwtPayload;
}

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

export interface LoginDto {
  telephone: string;
  motDePasse: string;
}

export interface RegisterDto {
  telephone: string;
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
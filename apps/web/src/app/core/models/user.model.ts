// core/models/user.model.ts

export type Role =
  | 'PATIENT'
  | 'ASC'
  | 'ASC_SUPERVISOR'
  | 'MEDECIN'
  | 'PHARMACIEN'
  | 'ADMIN_STRUCTURE'
  | 'ADMIN_REGIONAL'
  | 'ADMIN_NATIONAL'
  | 'SUPER_ADMIN';

export interface User {
  id: string;
  telephone: string;
  nom: string;
  prenom: string;
  role: Role;
  actif: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}

export interface LoginPayload {
  telephone: string;
  motDePasse: string;
}

export interface RegisterPayload {
  telephone: string;
  motDePasse: string;
  nom: string;
  prenom: string;
  role: Role;
}
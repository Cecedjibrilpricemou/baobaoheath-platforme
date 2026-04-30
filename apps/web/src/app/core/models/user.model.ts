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
  email?: string;
  nom: string;
  prenom: string;
  role: Role;
  langue: string;
  photoUrl?: string;
  estActif: boolean;
  doitChangerMotDePasse: boolean; // ← NOUVEAU
  creeLe: string;
  modifieLe: string;
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
  identifiant: string;
  motDePasse: string;
}

export interface RegisterPayload {
  telephone: string;
  email?: string;
  motDePasse: string;
  nom: string;
  prenom: string;
  role: Role;
}

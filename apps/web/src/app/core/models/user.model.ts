// core/models/user.model.ts
// Champs alignés avec le backend BaoBaoHealth (Prisma schema Utilisateur)

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
  estActif: boolean;   // était "actif" — champ réel backend
  creeLe: string;      // était "createdAt" — champ réel backend
  modifieLe: string;   // était "updatedAt" — champ réel backend
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

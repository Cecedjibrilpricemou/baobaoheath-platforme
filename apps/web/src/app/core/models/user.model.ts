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

// Connexion par téléphone OU email
export interface LoginPayload {
  identifiant: string; // téléphone ou email
  motDePasse: string;
}

// Inscription — téléphone obligatoire, email optionnel
export interface RegisterPayload {
  telephone: string;
  email?: string;        // ← NOUVEAU optionnel
  motDePasse: string;
  nom: string;
  prenom: string;
  role: Role;
}

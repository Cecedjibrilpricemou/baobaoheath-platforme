export type Role =
  | 'PATIENT' | 'ASC' | 'ASC_SUPERVISOR' | 'MEDECIN'
  | 'PHARMACIEN' | 'ADMIN_STRUCTURE' | 'ADMIN_REGIONAL'
  | 'ADMIN_NATIONAL' | 'SUPER_ADMIN';

export interface LoginDto {
  telephone: string;
  motDePasse: string;
}

export interface UserDto {
  id: string;
  prenom: string;
  nom: string;
  role: Role;
}

export interface AuthResponse {
  accessToken: string;
  user: UserDto;
}

export interface PatientDto {
  id: string;
  prenom: string;
  nom: string;
  qrCode: string;
  prefecture: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: Record<string, unknown>;
}
// core/models/user.model.ts
export type { Role, UserDto } from '@baobaoheath/shared-types';
import type { UserDto } from '@baobaoheath/shared-types';

export type User = UserDto;

export interface LoginPayload {
  identifiant: string;
  motDePasse: string;
}

export interface RegisterPayload {
  nom: string;
  prenom: string;
  telephone: string;
  email?: string;
  motDePasse: string;
  role?: import('@baobaoheath/shared-types').Role;
}

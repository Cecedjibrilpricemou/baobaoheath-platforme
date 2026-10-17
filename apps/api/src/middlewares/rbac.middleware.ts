import { Response, NextFunction } from 'express';
import { Role } from '../config/generated/client/client';
import { AuthRequest } from './auth.middleware';
import { ForbiddenError, UnauthorizedError } from '../utils/app-error';

/** Middleware de garde, porteur des rôles qu'il laisse passer. */
export interface GardeDeRole {
  (req: AuthRequest, _res: Response, next: NextFunction): void;
  /**
   * Les rôles autorisés, lisibles de l'extérieur.
   *
   * Sans cette étiquette, le câblage des permissions n'est vérifiable qu'en
   * appelant l'API : une garde retirée par mégarde d'une route ne casserait
   * aucun test. Elle permet de parcourir la pile d'un routeur et d'affirmer
   * qui peut atteindre quoi (voir `tests/routes-permissions.test.ts`).
   */
  readonly roles: readonly Role[];
}

export function requireRole(...roles: Role[]): GardeDeRole {
  const garde = (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError('Non authentifié'));
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(new ForbiddenError('Accès refusé — permissions insuffisantes'));
      return;
    }

    next();
  };

  return Object.assign(garde, { roles: Object.freeze([...roles]) }) as GardeDeRole;
}
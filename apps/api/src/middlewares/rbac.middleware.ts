import { Response, NextFunction } from 'express';
import { Role, RoleOfficine } from '../config/generated/client/client';
import { AuthRequest } from './auth.middleware';
import { ForbiddenError, UnauthorizedError } from '../utils/app-error';
import { prisma } from '../config/prisma';

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
  readonly rolesOfficine?: readonly RoleOfficine[];
}

/** Limite une route officine selon le profil métier, sans multiplier les rôles globaux. */
export function requireOfficineRole(...rolesOfficine: RoleOfficine[]) {
  const garde = async (req: AuthRequest, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      next(new UnauthorizedError('Non authentifié'));
      return;
    }

    try {
      const profile = await prisma.pharmacienProfile.findUnique({
        where: { idUtilisateur: req.user.userId },
        select: {
          roleOfficine: true,
          roleOfficineTemporaire: true,
          roleOfficineExpireLe: true,
        },
      });
      const roleEffectif = profile?.roleOfficineTemporaire
        && profile.roleOfficineExpireLe
        && profile.roleOfficineExpireLe > new Date()
        ? profile.roleOfficineTemporaire
        : profile?.roleOfficine;
      if (!roleEffectif || !rolesOfficine.includes(roleEffectif)) {
        next(new ForbiddenError('Accès réservé aux rôles autorisés de cette officine'));
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
  return Object.assign(garde, { rolesOfficine: Object.freeze([...rolesOfficine]) });
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
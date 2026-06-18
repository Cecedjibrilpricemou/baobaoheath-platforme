import { Response, NextFunction } from 'express';
import { Role } from '../config/generated/client/client';
import { AuthRequest } from './auth.middleware';
import { ForbiddenError, UnauthorizedError } from '../utils/app-error';

export function requireRole(...roles: Role[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
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
}
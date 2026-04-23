import { Response, NextFunction } from 'express';
import { Role } from '../config/generated/client/client';
import { AuthRequest } from './auth.middleware';

export function requireRole(...roles: Role[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Non authentifié',
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: 'Accès refusé — permissions insuffisantes',
      });
      return;
    }

    next();
  };
}
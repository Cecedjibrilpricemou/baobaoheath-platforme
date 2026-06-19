import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.utils';
import { JwtPayload } from '../types/auth.types';
import { prisma } from '../config/prisma';
import { UnauthorizedError } from '../utils/app-error';
import { setContextUserId } from '../utils/request-context';

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export async function authenticate(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next(new UnauthorizedError('Token manquant ou invalide'));
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = verifyAccessToken(token);
    const session = await prisma.session.findUnique({
      where: { id: payload.sessionId },
      include: { utilisateur: true },
    });

    if (!session || session.idUtilisateur !== payload.userId || session.expireLe < new Date()) {
      next(new UnauthorizedError('Session expirée ou invalide'));
      return;
    }

    if (!session.utilisateur.estActif) {
      next(new UnauthorizedError('Utilisateur désactivé'));
      return;
    }

    req.user = {
      userId: session.utilisateur.id,
      role: session.utilisateur.role,
      sessionId: session.id,
    };
    setContextUserId(session.utilisateur.id);
    next();
  } catch {
    next(new UnauthorizedError('Token expiré ou invalide'));
  }
}

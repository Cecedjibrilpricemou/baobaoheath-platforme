import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.utils';
import { JwtPayload } from '../types/auth.types';
import { prisma } from '../config/prisma';
import { UnauthorizedError, ForbiddenError } from '../utils/app-error';
import { setContextUserId } from '../utils/request-context';

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export const ACCESS_COOKIE = 'bb_access';
export const CSRF_COOKIE = 'bb_csrf';
const CSRF_HEADER = 'x-csrf-token';
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Shared by the HTTP `authenticate` middleware and the WebSocket handshake —
 * one source of truth for "is this access token still backed by a live session".
 */
export async function verifySessionFromToken(token: string): Promise<JwtPayload> {
  const payload = verifyAccessToken(token);
  const session = await prisma.session.findUnique({
    where: { id: payload.sessionId },
    include: { utilisateur: true },
  });

  if (!session || session.idUtilisateur !== payload.userId || session.expireLe < new Date()) {
    throw new UnauthorizedError('Session expirée ou invalide');
  }
  if (!session.utilisateur.estActif) {
    throw new UnauthorizedError('Utilisateur désactivé');
  }

  return {
    userId: session.utilisateur.id,
    role: session.utilisateur.role,
    sessionId: session.id,
  };
}

export async function authenticate(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const cookieToken = (req.cookies as Record<string, string> | undefined)?.[ACCESS_COOKIE];
  const authHeader = req.headers.authorization;
  const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : undefined;
  const token = cookieToken ?? headerToken;

  if (!token) {
    next(new UnauthorizedError('Token manquant ou invalide'));
    return;
  }

  try {
    req.user = await verifySessionFromToken(token);
    setContextUserId(req.user.userId);
  } catch {
    next(new UnauthorizedError('Token expiré ou invalide'));
    return;
  }

  if (MUTATING_METHODS.has(req.method)) {
    const csrfCookie = (req.cookies as Record<string, string> | undefined)?.[CSRF_COOKIE];
    const csrfHeader = req.headers[CSRF_HEADER];
    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
      next(new ForbiddenError('Jeton CSRF manquant ou invalide'));
      return;
    }
  }

  next();
}

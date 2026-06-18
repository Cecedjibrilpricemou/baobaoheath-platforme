import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';

const SENSITIVE_KEYS = new Set([
  'motDePasse',
  'motDePasseActuel',
  'nouveauMotDePasse',
  'motDePasseHash',
  'refreshToken',
  'accessToken',
  'token',
  'twoFaSecret',
]);

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitize);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      SENSITIVE_KEYS.has(key) ? '[REDACTED]' : sanitize(item),
    ])
  );
}

function shouldAudit(req: Request): boolean {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return true;

  return req.method === 'GET' && (
    req.originalUrl.includes('/patients') ||
    req.originalUrl.includes('/consultations') ||
    req.originalUrl.includes('/fhir') ||
    req.originalUrl.includes('/analytics/export')
  );
}

function resourceFromPath(path: string): string {
  const segments = path.split('/').filter(Boolean);
  const apiIndex = segments.findIndex((segment) => segment === 'v1');
  return segments[apiIndex + 1] ?? segments[0] ?? 'unknown';
}

export function auditRequest(req: AuthRequest, res: Response, next: NextFunction): void {
  res.on('finish', () => {
    if (!req.user || !shouldAudit(req)) return;

    void prisma.journalAudit.create({
      data: {
        idUtilisateur: req.user.userId,
        action: `${req.method} ${req.route?.path ?? req.path}`,
        ressource: resourceFromPath(req.path),
        idRessource: typeof req.params?.id === 'string' ? req.params.id : undefined,
        ipAdresse: req.ip,
        userAgent: req.get('user-agent'),
        metadonnees: sanitize({
          statusCode: res.statusCode,
          originalUrl: req.originalUrl,
          params: req.params,
          query: req.query,
          body: req.body,
        }) as object,
      },
    }).catch((error: unknown) => {
      console.error('Audit log failed', error);
    });
  });

  next();
}

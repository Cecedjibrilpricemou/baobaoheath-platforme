import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { logger } from '../config/logger';
import { getRequestId } from '../utils/request-context';

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
    req.originalUrl.includes('/analytics/export') ||
    // Scanner un QR patient, c'est consulter son dossier : le geste laisse une
    // trace, au meme titre qu'une lecture de fiche. Ni le scan du comptoir
    // pharmacie ni celui du laboratoire n'etaient traces jusqu'au 2026-09-29.
    //
    // Attention a ne pas surestimer ce que cela couvre : le QUI et le QUAND
    // sont enregistres, mais le patient concerne n'arrive que dans
    // `metadonnees.params.qrCode` — `idRessource` reste vide, le middleware ne
    // lisant que `req.params.id`. Repondre a « qui a consulte mon dossier ? »
    // demande donc une requete sur du JSON non indexe. EF-02-08 (journal des
    // acces consultable par le patient) reste a faire en P4.
    req.originalUrl.includes('/scan/')
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
          requestId: getRequestId(),
          statusCode: res.statusCode,
          originalUrl: req.originalUrl,
          params: req.params,
          query: req.query,
          body: req.body,
        }) as object,
      },
    }).catch((error: unknown) => {
      logger.error('Audit log failed', { error });
    });
  });

  next();
}

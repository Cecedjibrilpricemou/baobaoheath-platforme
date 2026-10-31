import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/app-error';
import { logger } from '../config/logger';
import { captureError } from '../config/sentry';
import { Prisma } from '../config/generated/client/client';

/**
 * Middleware global de gestion des erreurs.
 *
 * Express 5 capture automatiquement les erreurs lancées dans les
 * handlers async et les transmet ici. Cela permet de retirer tous
 * les blocs try/catch des contrôleurs.
 *
 * Comportement :
 * - Si l'erreur est une `AppError`, on utilise son `statusCode`.
 * - Sinon, on renvoie 500 et on masque le message en production.
 */
export function globalErrorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    logger.warn(`${req.method} ${req.originalUrl} -> ${err.statusCode} ${err.message}`);
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
    });
    return;
  }

  // Violation d'unicite (P2002) : deux requetes simultanees ont depasse le
  // controle de doublon du service. C'est un conflit, pas une panne — 409,
  // avec un message neutre : le detail nomme la table et la contrainte.
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    logger.warn(`${req.method} ${req.originalUrl} -> 409 contrainte d'unicite`, { cible: err.meta?.['target'] });
    res.status(409).json({ success: false, error: 'Cette valeur est deja utilisee.' });
    return;
  }

  // Erreurs inattendues (bugs, erreurs Prisma, etc.)
  captureError(err, { method: req.method, url: req.originalUrl });
  logger.error(`Erreur non geree: ${req.method} ${req.originalUrl}`, { stack: err.stack ?? err.message });

  res.status(500).json({
    success: false,
    error:
      process.env.NODE_ENV === 'production'
        ? 'Erreur interne du serveur'
        : err.message,
  });
}

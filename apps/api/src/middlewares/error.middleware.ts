import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/app-error';
import { logger } from '../config/logger';

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

  // Erreurs inattendues (bugs, erreurs Prisma, etc.)
  logger.error(`Erreur non geree: ${req.method} ${req.originalUrl}`, { stack: err.stack ?? err.message });

  res.status(500).json({
    success: false,
    error:
      process.env.NODE_ENV === 'production'
        ? 'Erreur interne du serveur'
        : err.message,
  });
}

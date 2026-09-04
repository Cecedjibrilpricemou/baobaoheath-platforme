import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodTypeAny } from 'zod';
import { ValidationError } from '../utils/app-error';

function formatZodError(error: ZodError) {
  return error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join(', ');
}

export function validateBody(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(new ValidationError(`Données invalides : ${formatZodError(result.error)}`));
      return;
    }

    req.body = result.data;
    next();
  };
}

export function validateQuery(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      next(new ValidationError(`Paramètres invalides : ${formatZodError(result.error)}`));
      return;
    }

    // Express 5 expose `req.query` en lecture seule (getter sans setter) :
    // une affectation directe lève une TypeError. On redéfinit donc la
    // propriété pour exposer les valeurs validées aux contrôleurs.
    Object.defineProperty(req, 'query', {
      value: result.data,
      writable: true,
      configurable: true,
      enumerable: true,
    });
    next();
  };
}

import { Router, Request, Response, NextFunction } from 'express';
import { ussdSessionController } from '../controllers/ussd.controller';
import { validateBody } from '../middlewares/validate.middleware';
import { ussdSessionSchema } from '../validators/api.schemas';
import { verifierPasserelleUssd } from '../services/ussd.service';
import { logger } from '../config/logger';

const router = Router();

/**
 * Seul l'operateur passe. Il signe `horodatage.sessionId.phoneNumber.text`
 * avec le secret partage `USSD_HMAC_KEY` et envoie :
 *
 * - `X-Ussd-Timestamp` : l'heure en secondes Unix (cinq minutes de tolerance) ;
 * - `X-Ussd-Signature` : le HMAC-SHA256 en hexadecimal.
 *
 * `USSD_ALLOWED_IPS`, facultatif, restreint en plus aux adresses de
 * l'operateur. Sans secret configure, la route repond 503 : fermee par defaut.
 */
export function authentifierPasserelleUssd(req: Request, res: Response, next: NextFunction): void {
  const verdict = verifierPasserelleUssd({
    horodatage: req.header('X-Ussd-Timestamp') ?? '',
    signature: req.header('X-Ussd-Signature') ?? '',
    ip: req.ip,
    corps: (req.body ?? {}) as Record<string, string>,
  });

  if (verdict === 'ok') {
    next();
    return;
  }
  if (verdict === 'non-configuree') {
    logger.error('[USSD] USSD_HMAC_KEY absente : la passerelle est fermee');
    res.status(503).type('text/plain').send('END Service indisponible.');
    return;
  }
  logger.warn('[USSD] appel refuse : signature, horodatage ou adresse invalide', { ip: req.ip });
  res.status(401).type('text/plain').send('END Acces refuse.');
}

router.post('/session', authentifierPasserelleUssd, validateBody(ussdSessionSchema), ussdSessionController);

export default router;

import { Response } from 'express';
import { ConsentScope } from '../config/generated/client/client';
import { AuthRequest } from '../middlewares/auth.middleware';
import * as privacyService from '../services/privacy.service';

export async function getMyConsentsController(req: AuthRequest, res: Response): Promise<void> {
  const data = await privacyService.getMyConsents(req.user!.userId);
    res.status(200).json({ success: true, data });
}

export async function setConsentController(req: AuthRequest, res: Response): Promise<void> {
  const data = await privacyService.setConsent(
      req.user!.userId,
      req.body.scope as ConsentScope,
      req.body.actif,
      req.body.source,
      req.body.commentaire
    );
    res.status(200).json({ success: true, data });
}

export async function getMyAuditLogsController(req: AuthRequest, res: Response): Promise<void> {
  const result = await privacyService.getMyAuditLogs(req.user!.userId, {
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    res.status(200).json({ success: true, ...result });
}

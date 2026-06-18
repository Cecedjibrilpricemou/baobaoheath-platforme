import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import * as syncService from '../services/sync.service';

export async function getChangesController(req: AuthRequest, res: Response): Promise<void> {
  const since = typeof req.query.since === 'string' ? new Date(req.query.since) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const scope = typeof req.query.scope === 'string' ? req.query.scope : undefined;

    if (since && Number.isNaN(since.getTime())) {
      res.status(400).json({ success: false, error: 'Parametre since invalide' });
      return;
    }

    const result = await syncService.getSyncChanges(req.user!, { since, limit, scope });
    res.status(200).json({ success: true, ...result });
}

export async function pushMutationsController(req: AuthRequest, res: Response): Promise<void> {
  const result = await syncService.pushSyncMutations(req.user!, req.body.mutations);
    res.status(202).json({ success: true, ...result });
}

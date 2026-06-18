import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { evaluerTriage } from '../services/triage.service';

export async function evaluerTriageController(req: AuthRequest, res: Response): Promise<void> {
  const data = evaluerTriage(req.body);
    res.status(200).json({ success: true, data });
}

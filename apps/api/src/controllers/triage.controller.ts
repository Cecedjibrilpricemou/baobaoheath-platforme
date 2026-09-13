import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { evaluerTriage } from '../services/triage.service';
import { getValeursParametres } from '../services/parametres.service';
import { ForbiddenError } from '../utils/app-error';

export async function evaluerTriageController(req: AuthRequest, res: Response): Promise<void> {
  // Interrupteur "assistant de triage" de la page Parametres du super-admin.
  const { alertes } = await getValeursParametres();
  if (!alertes.activerIA) {
    throw new ForbiddenError("L'assistant de triage est desactive par l'administrateur");
  }

  const data = evaluerTriage(req.body);
    res.status(200).json({ success: true, data });
}

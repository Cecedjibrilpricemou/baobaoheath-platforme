import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';
import * as pharmacienService from '../services/pharmacien.service';

/**
 * Catalogue des medicaments, en lecture seule.
 *
 * La seule liste existante etait GET /pharmacien/medicaments, reservee au role
 * PHARMACIEN : l'agent de sante qui redige une ordonnance depuis la fiche de
 * consultation n'avait aucun moyen de choisir un medicament. Le catalogue ne
 * contient aucune donnee patient, il est donc ouvert aux roles soignants.
 */
const router = Router();

router.use(authenticate);

router.get(
  '/',
  requireRole('ASC', 'ASC_SUPERVISOR', 'MEDECIN', 'PHARMACIEN', 'ADMIN_STRUCTURE'),
  async (_req: AuthRequest, res: Response) => {
    const data = await pharmacienService.getMedicaments();
    res.json({ success: true, data });
  }
);

export default router;

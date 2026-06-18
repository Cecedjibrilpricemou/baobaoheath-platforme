import { Router } from 'express';
import {
  initierPaiementController,
  verifierStatutPaiementController,
  confirmerPaiementController,
  getHistoriquePaiementsController,
  annulerPaiementController,
} from '../controllers/paiement.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import { confirmerPaiementSchema, initierPaiementSchema } from '../validators/api.schemas';

const router = Router();

router.use(authenticate);

router.post('/', requireRole('PATIENT'), validateBody(initierPaiementSchema), initierPaiementController);
router.get('/historique', requireRole('PATIENT'), getHistoriquePaiementsController);
router.get('/:id/statut', requireRole('PATIENT'), verifierStatutPaiementController);
router.post('/:id/annuler', requireRole('PATIENT'), annulerPaiementController);
router.post('/:id/confirmer', requireRole('ADMIN_STRUCTURE', 'ADMIN_REGIONAL', 'PHARMACIEN'), validateBody(confirmerPaiementSchema), confirmerPaiementController);

export default router;

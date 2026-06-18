import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import * as ctrl from '../controllers/pharmacien.controller';
import {
  createAgentPharmacieSchema,
  delivrerOrdonnanceSchema,
  reapprovisionnerStockSchema,
} from '../validators/api.schemas';

const router = Router();

router.use(authenticate);
router.use(requireRole('PHARMACIEN'));

router.get('/scan/:qrCode', ctrl.scanPatientController);
router.post('/ordonnances/:id/delivrer', validateBody(delivrerOrdonnanceSchema), ctrl.delivrerOrdonnanceController);
router.get('/stocks', ctrl.getStocksController);
router.post('/stocks/reapprovisionner', validateBody(reapprovisionnerStockSchema), ctrl.reapprovisionnerStockController);
router.get('/ordonnances', ctrl.getOrdonnancesController);
router.get('/medicaments', ctrl.getMedicamentsController);
router.get('/agents', ctrl.getAgentsController);
router.post('/agents', validateBody(createAgentPharmacieSchema), ctrl.creerAgentController);

export default router;

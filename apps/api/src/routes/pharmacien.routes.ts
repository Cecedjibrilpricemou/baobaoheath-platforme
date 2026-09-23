import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import * as ctrl from '../controllers/pharmacien.controller';
import {
  createAgentPharmacieSchema,
  delivrerOrdonnanceSchema,
  reapprovisionnerStockSchema,
  verifierOrdonnanceSchema,
} from '../validators/api.schemas';

const router = Router();

router.use(authenticate);
router.use(requireRole('PHARMACIEN'));

router.get('/scan/:qrCode', ctrl.scanPatientController);
// EF-07-01 : controle d'une ordonnance presentee sans QR patient (papier,
// ordonnance d'un proche). Declaree avant `/ordonnances/:id/...` pour que
// « verifier » ne soit pas capture comme un identifiant.
router.post('/ordonnances/verifier', validateBody(verifierOrdonnanceSchema), ctrl.verifierOrdonnanceController);
// `:id` designe une ligne : la delivrance se fait medicament par medicament.
router.post('/ordonnances/:id/delivrer', validateBody(delivrerOrdonnanceSchema), ctrl.delivrerOrdonnanceController);
router.get('/stocks', ctrl.getStocksController);
router.post('/stocks/reapprovisionner', validateBody(reapprovisionnerStockSchema), ctrl.reapprovisionnerStockController);
router.get('/ordonnances', ctrl.getOrdonnancesController);
router.get('/medicaments', ctrl.getMedicamentsController);
router.get('/agents', ctrl.getAgentsController);
router.post('/agents', validateBody(createAgentPharmacieSchema), ctrl.creerAgentController);

export default router;

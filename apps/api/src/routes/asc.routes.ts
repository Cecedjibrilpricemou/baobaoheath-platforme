import { Router } from 'express';
import {
    getMyAscProfileController,
    updateAscProfileController,
    getAscPatientsController,
    getAscPlanningController,
    getAscStocksController,
    createStockController,
    updateStockController,
    getRapportMensuelController,
} from '../controllers/asc.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import {
  updateAscProfileSchema,
  createAscStockSchema,
  updateAscStockSchema,
} from '../validators/api.schemas';

const router = Router();

// ─── Tous les endpoints nécessitent auth + rôle ASC ──────
router.use(authenticate);
router.use(requireRole('ASC', 'ASC_SUPERVISOR'));

// ─── Profil ASC ───────────────────────────────────────────
router.get('/me', getMyAscProfileController);
router.put('/me', validateBody(updateAscProfileSchema), updateAscProfileController);

// ─── Patients de la zone ──────────────────────────────────
router.get('/patients', getAscPatientsController);

// ─── Planning ─────────────────────────────────────────────
router.get('/planning', getAscPlanningController);

// ─── Stocks ───────────────────────────────────────────────
router.get('/stocks', getAscStocksController);
router.post('/stocks', validateBody(createAscStockSchema), createStockController);
router.put('/stocks/:id', validateBody(updateAscStockSchema), updateStockController);

// ─── Rapport mensuel ──────────────────────────────────────
router.get('/rapport', getRapportMensuelController);

export default router;
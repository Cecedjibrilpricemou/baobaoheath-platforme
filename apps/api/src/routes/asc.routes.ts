import { Router } from 'express';
import {
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
  createAscStockSchema,
  updateAscStockSchema,
} from '../validators/api.schemas';

const router = Router();

// ─── Tous les endpoints nécessitent auth + rôle ASC ──────
router.use(authenticate);
router.use(requireRole('ASC', 'ASC_SUPERVISOR'));

// ─── Profil ASC ───────────────────────────────────────────

// ─── Patients de la zone ──────────────────────────────────

// ─── Planning ─────────────────────────────────────────────
router.get('/planning', getAscPlanningController);

// ─── Stocks ───────────────────────────────────────────────
router.get('/stocks', getAscStocksController);
router.post('/stocks', validateBody(createAscStockSchema), createStockController);
router.put('/stocks/:id', validateBody(updateAscStockSchema), updateStockController);

// ─── Rapport mensuel ──────────────────────────────────────
router.get('/rapport', getRapportMensuelController);

export default router;
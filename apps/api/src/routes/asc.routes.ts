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

const router = Router();

// ─── Tous les endpoints nécessitent auth + rôle ASC ──────
router.use(authenticate);
router.use(requireRole('ASC', 'ASC_SUPERVISOR'));

// ─── Profil ASC ───────────────────────────────────────────
router.get('/me', getMyAscProfileController);
router.put('/me', updateAscProfileController);

// ─── Patients de la zone ──────────────────────────────────
router.get('/patients', getAscPatientsController);

// ─── Planning ─────────────────────────────────────────────
router.get('/planning', getAscPlanningController);

// ─── Stocks ───────────────────────────────────────────────
router.get('/stocks', getAscStocksController);
router.post('/stocks', createStockController);
router.put('/stocks/:id', updateStockController);

// ─── Rapport mensuel ──────────────────────────────────────
router.get('/rapport', getRapportMensuelController);

export default router;
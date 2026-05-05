// src/routes/pharmacien.routes.ts
import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';
import * as ctrl from '../controllers/pharmacien.controller';

const router = Router();
router.use(authenticate);
router.use(requireRole('PHARMACIEN'));

router.get('/scan/:qrCode',           ctrl.scanPatientController);
router.post('/ordonnances/:id/delivrer', ctrl.delivrerOrdonnanceController);
router.get('/stocks',                 ctrl.getStocksController);
router.get('/ordonnances',            ctrl.getOrdonnancesController);

export default router;

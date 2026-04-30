// src/routes/pharmacien.routes.ts
import { Router } from 'express';
import {
  scanPatientController,
  delivrerOrdonnanceController,
  getStocksController,
  trouverPharmaciesProchesController
} from '../controllers/pharmacien.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';

const router = Router();

router.use(authenticate);
router.use(requireRole('PHARMACIEN'));

// Scan QR Code patient → ordonnances filtrées
router.get('/scan/:qrCode', scanPatientController);

// Délivrer une ordonnance + paiement
router.post('/ordonnances/:id/delivrer', delivrerOrdonnanceController);

// Stocks de la pharmacie
router.get('/stocks', getStocksController);

// Trouver pharmacies proches avec un médicament
router.get('/pharmacies-proches/:idMedicament', trouverPharmaciesProchesController);

export default router;

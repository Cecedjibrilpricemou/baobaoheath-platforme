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

const router = Router();

// ─── Tous les endpoints nécessitent authentification ─────
router.use(authenticate);

// ─── Routes Patient ───────────────────────────────────────
router.post(
  '/',
  requireRole('PATIENT'),
  initierPaiementController
);

router.get(
  '/historique',
  requireRole('PATIENT'),
  getHistoriquePaiementsController
);

router.get(
  '/:id/statut',
  requireRole('PATIENT'),
  verifierStatutPaiementController
);

router.post(
  '/:id/annuler',
  requireRole('PATIENT'),
  annulerPaiementController
);

// ─── Routes Admin / Structure ─────────────────────────────
router.post(
  '/:id/confirmer',
  requireRole('ADMIN_STRUCTURE', 'ADMIN_REGIONAL', 'PHARMACIEN'),
  confirmerPaiementController
);

export default router;
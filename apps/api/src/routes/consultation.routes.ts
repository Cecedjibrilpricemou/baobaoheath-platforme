import { Router } from 'express';
import {
  createConsultationController,
  getConsultationByIdController,
  getConsultationsController,
  updateConsultationController,
  saveVitalsController,
  completeConsultationController,
  addDiagnosticController,
  getDiagnosticsController,
  addOrdonnanceController,
  createReferralController,
} from '../controllers/consultation.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';

const router = Router();

// ─── Tous les endpoints nécessitent une authentification ──
router.use(authenticate);

// ─── Liste des consultations ──────────────────────────────
router.get(
  '/',
  requireRole('ASC', 'ASC_SUPERVISOR', 'MEDECIN', 'ADMIN_STRUCTURE'),
  getConsultationsController
);

// ─── Ouvrir une nouvelle consultation ────────────────────
router.post(
  '/',
  requireRole('ASC', 'ASC_SUPERVISOR'),
  createConsultationController
);

// ─── Détail d'une consultation ────────────────────────────
router.get(
  '/:id',
  requireRole('ASC', 'ASC_SUPERVISOR', 'MEDECIN', 'ADMIN_STRUCTURE'),
  getConsultationByIdController
);

// ─── Mettre à jour une consultation ──────────────────────
router.put(
  '/:id',
  requireRole('ASC', 'ASC_SUPERVISOR'),
  updateConsultationController
);

// ─── Saisir les constantes vitales ───────────────────────
router.post(
  '/:id/vitals',
  requireRole('ASC', 'ASC_SUPERVISOR'),
  saveVitalsController
);

// ─── Clôturer une consultation ────────────────────────────
router.post(
  '/:id/complete',
  requireRole('ASC', 'ASC_SUPERVISOR'),
  completeConsultationController
);

// ─── Diagnostics ──────────────────────────────────────────
router.get(
  '/:id/diagnostics',
  requireRole('ASC', 'ASC_SUPERVISOR', 'MEDECIN'),
  getDiagnosticsController
);

router.post(
  '/:id/diagnostics',
  requireRole('ASC', 'ASC_SUPERVISOR', 'MEDECIN'),
  addDiagnosticController
);

// ─── Ordonnances ──────────────────────────────────────────
router.post(
  '/:id/ordonnances',
  requireRole('ASC', 'ASC_SUPERVISOR', 'MEDECIN'),
  addOrdonnanceController
);

// ─── Référencement ────────────────────────────────────────
router.post(
  '/:id/referral',
  requireRole('ASC', 'ASC_SUPERVISOR'),
  createReferralController
);

export default router;
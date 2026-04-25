import { Router } from 'express';
import {
    envoyerSmsController,
    envoyerRappelRendezVousController,
    envoyerAlerteStockController,
    envoyerNotificationReferencementController,
    envoyerRappelVaccinationController,
    envoyerSmsMasseController,
    verifierRappelsController,
} from '../controllers/notification.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';

const router = Router();

// ─── Tous les endpoints nécessitent authentification ─────
router.use(authenticate);

// ─── SMS personnalisé — Admin uniquement ──────────────────
router.post(
    '/sms',
    requireRole('ADMIN_STRUCTURE', 'ADMIN_REGIONAL', 'ADMIN_NATIONAL', 'SUPER_ADMIN'),
    envoyerSmsController
);

// ─── SMS en masse par préfecture — Admin ──────────────────
router.post(
    '/sms/masse',
    requireRole('ADMIN_REGIONAL', 'ADMIN_NATIONAL', 'SUPER_ADMIN'),
    envoyerSmsMasseController
);

// ─── Rappel rendez-vous — ASC ─────────────────────────────
router.post(
    '/rappel/rendez-vous/:id',
    requireRole('ASC', 'ASC_SUPERVISOR'),
    envoyerRappelRendezVousController
);

// ─── Rappel vaccination — ASC / Médecin ───────────────────
router.post(
    '/rappel/vaccination/:id',
    requireRole('ASC', 'ASC_SUPERVISOR', 'MEDECIN'),
    envoyerRappelVaccinationController
);

// ─── Alerte stock — ASC ───────────────────────────────────
router.post(
    '/alerte/stock/:id',
    requireRole('ASC', 'ASC_SUPERVISOR'),
    envoyerAlerteStockController
);

// ─── Notification référencement — Médecin ─────────────────
router.post(
    '/referencement/:id',
    requireRole('MEDECIN', 'ADMIN_STRUCTURE'),
    envoyerNotificationReferencementController
);

// ─── Vérifier rappels à envoyer — Admin ───────────────────
router.get(
    '/rappels/verifier',
    requireRole('ADMIN_STRUCTURE', 'ADMIN_REGIONAL', 'ADMIN_NATIONAL', 'SUPER_ADMIN'),
    verifierRappelsController
);

export default router;
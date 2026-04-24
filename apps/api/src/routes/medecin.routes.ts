import { Router } from 'express';
import {
  getMyMedecinProfileController,
  getDashboardStatsController,
  getConsultationsAValiderController,
  validerConsultationController,
  getReferencementsController,
  repondreReferencementController,
  sendMessageController,
  getMessagesController,
} from '../controllers/medecin.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';

const router = Router();

// ─── Tous les endpoints nécessitent auth + rôle MEDECIN ──
router.use(authenticate);
router.use(requireRole('MEDECIN', 'ADMIN_STRUCTURE', 'ADMIN_REGIONAL'));

// ─── Profil et dashboard ──────────────────────────────────
router.get('/me', getMyMedecinProfileController);
router.get('/dashboard', getDashboardStatsController);

// ─── Consultations ────────────────────────────────────────
router.get('/consultations', getConsultationsAValiderController);
router.put('/consultations/:id/valider', validerConsultationController);

// ─── Référencements ───────────────────────────────────────
router.get('/referencements', getReferencementsController);
router.put('/referencements/:id/repondre', repondreReferencementController);

// ─── Messagerie ───────────────────────────────────────────
router.get('/messages', getMessagesController);
router.post('/messages', sendMessageController);

export default router;
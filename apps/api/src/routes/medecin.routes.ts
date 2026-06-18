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
import { validateBody } from '../middlewares/validate.middleware';
import {
  validerConsultationSchema,
  repondreReferencementSchema,
  sendMessageSchema,
} from '../validators/api.schemas';

const router = Router();

// ─── Tous les endpoints nécessitent auth + rôle MEDECIN ──
router.use(authenticate);
router.use(requireRole('MEDECIN', 'ADMIN_STRUCTURE', 'ADMIN_REGIONAL'));

// ─── Profil et dashboard ──────────────────────────────────
router.get('/me', getMyMedecinProfileController);
router.get('/dashboard', getDashboardStatsController);

// ─── Consultations ────────────────────────────────────────
router.get('/consultations', getConsultationsAValiderController);
router.put('/consultations/:id/valider', validateBody(validerConsultationSchema), validerConsultationController);

// ─── Référencements ───────────────────────────────────────
router.get('/referencements', getReferencementsController);
router.put('/referencements/:id/repondre', validateBody(repondreReferencementSchema), repondreReferencementController);

// ─── Messagerie ───────────────────────────────────────────
router.get('/messages', getMessagesController);
router.post('/messages', validateBody(sendMessageSchema), sendMessageController);

export default router;
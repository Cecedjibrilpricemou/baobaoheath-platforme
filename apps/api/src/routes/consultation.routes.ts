import { Router } from 'express';
import {
  createConsultationController,
  getConsultationByIdController,
  getConsultationsController,
  saveVitalsController,
  completeConsultationController,
  addDiagnosticController,
  addOrdonnanceController,
  createReferralController,
} from '../controllers/consultation.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import {
  createConsultationSchema,
  diagnosticSchema,
  ordonnanceSchema,
  referralSchema,
  vitalsSchema,
} from '../validators/api.schemas';

const router = Router();

router.use(authenticate);

router.get('/', requireRole('ASC', 'ASC_SUPERVISOR', 'MEDECIN', 'ADMIN_STRUCTURE'), getConsultationsController);
router.post('/', requireRole('ASC', 'ASC_SUPERVISOR'), validateBody(createConsultationSchema), createConsultationController);
router.get('/:id', requireRole('ASC', 'ASC_SUPERVISOR', 'MEDECIN', 'ADMIN_STRUCTURE'), getConsultationByIdController);
router.post('/:id/vitals', requireRole('ASC', 'ASC_SUPERVISOR'), validateBody(vitalsSchema), saveVitalsController);
router.post('/:id/complete', requireRole('ASC', 'ASC_SUPERVISOR'), completeConsultationController);
router.post('/:id/diagnostics', requireRole('ASC', 'ASC_SUPERVISOR', 'MEDECIN'), validateBody(diagnosticSchema), addDiagnosticController);
router.post('/:id/ordonnances', requireRole('ASC', 'ASC_SUPERVISOR', 'MEDECIN'), validateBody(ordonnanceSchema), addOrdonnanceController);
router.post('/:id/referral', requireRole('ASC', 'ASC_SUPERVISOR'), validateBody(referralSchema), createReferralController);

export default router;

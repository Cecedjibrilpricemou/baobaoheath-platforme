import { Router } from 'express';
import {
  getConsultationFhirController,
  getPatientBundleFhirController,
  getPatientFhirController,
} from '../controllers/fhir.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';

const router = Router();

router.use(authenticate);
router.use(requireRole('PATIENT', 'ASC', 'ASC_SUPERVISOR', 'MEDECIN', 'ADMIN_STRUCTURE', 'ADMIN_REGIONAL', 'ADMIN_NATIONAL', 'SUPER_ADMIN'));

router.get('/patients/:id', getPatientFhirController);
router.get('/patients/:id/bundle', getPatientBundleFhirController);
router.get('/consultations/:id', getConsultationFhirController);

export default router;

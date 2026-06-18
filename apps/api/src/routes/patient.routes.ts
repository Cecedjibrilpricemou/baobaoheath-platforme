import { Router } from 'express';
import {
  createPatientController,
  getPatientsController,
  getPatientByIdController,
  getPatientByQrCodeController,
  getMyProfileController,
  updateMyProfileController,
  exportDossierController,
  updateStructurePrefereeController,
} from '../controllers/patient.controller';
import { getMesConsultationsController } from '../controllers/consultation.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import {
  createPatientSchema,
  updatePatientSchema,
  updateStructurePrefereeSchema,
} from '../validators/api.schemas';

const router = Router();

router.post('/', validateBody(createPatientSchema), createPatientController);

router.get('/me', authenticate, requireRole('PATIENT'), getMyProfileController);
router.put('/me', authenticate, requireRole('PATIENT'), validateBody(updatePatientSchema), updateMyProfileController);
router.put('/me/structure', authenticate, requireRole('PATIENT'), validateBody(updateStructurePrefereeSchema), updateStructurePrefereeController);
router.get('/me/export', authenticate, requireRole('PATIENT'), exportDossierController);
router.get('/me/consultations', authenticate, requireRole('PATIENT'), getMesConsultationsController);

router.get('/', authenticate, requireRole('ASC', 'ASC_SUPERVISOR', 'MEDECIN', 'ADMIN_STRUCTURE'), getPatientsController);
router.get('/qr/:qrCode', authenticate, requireRole('ASC', 'ASC_SUPERVISOR', 'MEDECIN'), getPatientByQrCodeController);
router.get('/:id', authenticate, requireRole('ASC', 'ASC_SUPERVISOR', 'MEDECIN', 'ADMIN_STRUCTURE'), getPatientByIdController);

export default router;

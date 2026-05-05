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
import { authenticate } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';

const router = Router();

// ── Routes publiques ──────────────────────────────────────────────
router.post('/', createPatientController);

// ── Routes Patient connecté ───────────────────────────────────────
router.get('/me',           authenticate, requireRole('PATIENT'), getMyProfileController);
router.put('/me',           authenticate, requireRole('PATIENT'), updateMyProfileController);
router.put('/me/structure', authenticate, requireRole('PATIENT'), updateStructurePrefereeController); // ← AJOUTÉ
router.get('/me/export',    authenticate, requireRole('PATIENT'), exportDossierController);

// ── Routes ASC / Médecin ──────────────────────────────────────────
router.get('/',            authenticate, requireRole('ASC', 'ASC_SUPERVISOR', 'MEDECIN', 'ADMIN_STRUCTURE'), getPatientsController);
router.get('/qr/:qrCode',  authenticate, requireRole('ASC', 'ASC_SUPERVISOR', 'MEDECIN'), getPatientByQrCodeController);
router.get('/:id',         authenticate, requireRole('ASC', 'ASC_SUPERVISOR', 'MEDECIN', 'ADMIN_STRUCTURE'), getPatientByIdController);

export default router;
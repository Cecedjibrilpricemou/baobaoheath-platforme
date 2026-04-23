import { Router } from 'express';
import {
  createPatientController,
  getPatientsController,
  getPatientByIdController,
  getPatientByQrCodeController,
  getMyProfileController,
  updateMyProfileController,
  exportDossierController,
} from '../controllers/patient.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';

const router = Router();

// ─── Routes publiques ─────────────────────────────────────
// Créer un compte patient
router.post('/', createPatientController);

// ─── Routes protégées — Patient connecté ──────────────────
// Mon profil
router.get('/me', authenticate, requireRole('PATIENT'), getMyProfileController);

// Mettre à jour mon profil
router.put('/me', authenticate, requireRole('PATIENT'), updateMyProfileController);

// Exporter mon dossier médical complet
router.get('/me/export', authenticate, requireRole('PATIENT'), exportDossierController);

// ─── Routes protégées — ASC / Médecin ────────────────────
// Liste des patients
router.get(
  '/',
  authenticate,
  requireRole('ASC', 'ASC_SUPERVISOR', 'MEDECIN', 'ADMIN_STRUCTURE'),
  getPatientsController
);

// Recherche par QR Code
router.get(
  '/qr/:qrCode',
  authenticate,
  requireRole('ASC', 'ASC_SUPERVISOR', 'MEDECIN'),
  getPatientByQrCodeController
);

// Détail d'un patient par ID
router.get(
  '/:id',
  authenticate,
  requireRole('ASC', 'ASC_SUPERVISOR', 'MEDECIN', 'ADMIN_STRUCTURE'),
  getPatientByIdController
);

export default router;
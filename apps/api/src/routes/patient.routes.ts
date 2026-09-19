import { Router, Response } from 'express';
import type { AuthRequest } from '../middlewares/auth.middleware';
import * as hopital from '../services/hopital.service';
import * as labo from '../services/laboratoire.service';
import { ValidationError } from '../utils/app-error';
import type { EpisodePatientView, EvolutionResultatView, ExamenSuiviView } from '@baobaoheath/shared-types';
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

// P1 — parcours hospitalier du patient : episodes, demandes d'analyse, orientations.
router.get('/me/episodes', authenticate, requireRole('PATIENT'), async (req: AuthRequest, res: Response) => {
  const data: EpisodePatientView[] = await hopital.mesEpisodes(req.user!.userId);
  res.json({ success: true, data });
});
router.get('/me/demandes-analyse/:id/document', authenticate, requireRole('PATIENT'), async (req: AuthRequest, res: Response) => {
  const html = await hopital.documentDemandePourPatient(req.user!.userId, req.params['id'] as string);
  res.type('html').send(html);
});

// P2 — resultats diffuses au patient (EF-04-09) et courbes d'evolution (EF-04-10).
router.get('/me/demandes-analyse/:id/compte-rendu', authenticate, requireRole('PATIENT'), async (req: AuthRequest, res: Response) => {
  const html = await labo.compteRenduPatient(req.user!.userId, req.params['id'] as string);
  res.type('html').send(html);
});
router.get('/me/resultats/examens-suivis', authenticate, requireRole('PATIENT'), async (req: AuthRequest, res: Response) => {
  const data: ExamenSuiviView[] = await labo.examensSuivisPourPatient(req.user!.userId);
  res.json({ success: true, data });
});
router.get('/me/resultats/evolution', authenticate, requireRole('PATIENT'), async (req: AuthRequest, res: Response) => {
  const codeLoinc = req.query['codeLoinc'];
  if (typeof codeLoinc !== 'string' || !codeLoinc.trim()) throw new ValidationError('codeLoinc requis');
  const data: EvolutionResultatView = await labo.evolutionPourPatient(req.user!.userId, codeLoinc.trim());
  res.json({ success: true, data });
});

router.get('/', authenticate, requireRole('ASC', 'ASC_SUPERVISOR', 'MEDECIN', 'ADMIN_STRUCTURE'), getPatientsController);
router.get('/qr/:qrCode', authenticate, requireRole('ASC', 'ASC_SUPERVISOR', 'MEDECIN'), getPatientByQrCodeController);
router.get('/:id', authenticate, requireRole('ASC', 'ASC_SUPERVISOR', 'MEDECIN', 'ADMIN_STRUCTURE'), getPatientByIdController);

export default router;

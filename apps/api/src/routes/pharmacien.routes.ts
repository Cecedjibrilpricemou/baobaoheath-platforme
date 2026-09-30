import * as appro from '../services/approvisionnement.service';
import type { ApprovisionnementView, LotStockView, PeremptionProcheView } from '@baobaoheath/shared-types';
import { creerApprovisionnementSchema } from '../validators/api.schemas';
import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import * as ctrl from '../controllers/pharmacien.controller';
import {
  createAgentPharmacieSchema,
  delivrerOrdonnanceSchema,
  reapprovisionnerStockSchema,
  verifierOrdonnanceSchema,
} from '../validators/api.schemas';

const router = Router();

router.use(authenticate);
router.use(requireRole('PHARMACIEN'));

router.get('/scan/:qrCode', ctrl.scanPatientController);
// EF-07-01 : controle d'une ordonnance presentee sans QR patient (papier,
// ordonnance d'un proche). Declaree avant `/ordonnances/:id/...` pour que
// « verifier » ne soit pas capture comme un identifiant.
router.post('/ordonnances/verifier', validateBody(verifierOrdonnanceSchema), ctrl.verifierOrdonnanceController);
// EF-05-09 : `:id` designe ici l'ordonnance entiere, pas une ligne — un
// renouvellement rouvre tout le traitement.
router.post('/ordonnances/:id/renouveler', ctrl.renouvelerOrdonnanceController);
// `:id` designe une ligne : la delivrance se fait medicament par medicament.
router.post('/ordonnances/:id/delivrer', validateBody(delivrerOrdonnanceSchema), ctrl.delivrerOrdonnanceController);
// ── Approvisionnement et peremptions (addendum, points 1.3 et 1.4) ───
// Saisie assistee : la facture est attachee en justificatif. L'extraction
// automatique viendra ensuite, et devra toujours etre relue avant
// enregistrement.
router.post('/approvisionnements', validateBody(creerApprovisionnementSchema), async (req: AuthRequest, res: Response) => {
  const data: ApprovisionnementView = await appro.enregistrerApprovisionnement(req.user!, req.body);
  res.status(201).json({ success: true, data, message: 'Entree en stock enregistree' });
});

router.get('/approvisionnements', async (req: AuthRequest, res: Response) => {
  const data: ApprovisionnementView[] = await appro.listerApprovisionnements(req.user!);
  res.json({ success: true, data });
});

router.get('/peremptions', async (req: AuthRequest, res: Response) => {
  const jours = typeof req.query['jours'] === 'string' ? Number(req.query['jours']) : undefined;
  const data: PeremptionProcheView[] = await appro.peremptionsProches(req.user!, Number.isFinite(jours) ? jours : undefined);
  res.json({ success: true, data });
});

router.get('/medicaments/:id/lots', async (req: AuthRequest, res: Response) => {
  const data: LotStockView[] = await appro.lotsDuMedicament(req.user!, req.params['id'] as string);
  res.json({ success: true, data });
});

router.get('/stocks', ctrl.getStocksController);
router.post('/stocks/reapprovisionner', validateBody(reapprovisionnerStockSchema), ctrl.reapprovisionnerStockController);
router.get('/ordonnances', ctrl.getOrdonnancesController);
router.get('/medicaments', ctrl.getMedicamentsController);
router.get('/agents', ctrl.getAgentsController);
router.post('/agents', validateBody(createAgentPharmacieSchema), ctrl.creerAgentController);

export default router;

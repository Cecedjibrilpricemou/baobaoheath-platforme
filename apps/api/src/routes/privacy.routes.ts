import { Router, Response } from 'express';
import {
  getMyAuditLogsController,
  getMyConsentHistoryController,
  getMyConsentsController,
  setConsentController,
} from '../controllers/privacy.controller';
import { authenticate, AuthRequest } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import { consentSchema, deposerDemandeRgpdSchema } from '../validators/api.schemas';
import * as rgpd from '../services/rgpd.service';

const router = Router();

router.use(authenticate);
router.use(requireRole('PATIENT'));

router.get('/me/consents', getMyConsentsController);
router.put('/me/consents', validateBody(consentSchema), setConsentController);
router.get('/me/audit-logs', getMyAuditLogsController);

/**
 * L'histoire de ses consentements (EF-02-07).
 *
 * **C'est elle qui donne un sens au mot « versionne »** : le patient y lit ses
 * changements d'avis et le texte qui etait a l'ecran a chaque fois. En ajout
 * seul : deux declencheurs PostgreSQL refusent UPDATE, DELETE et TRUNCATE.
 */
router.get('/me/consents/historique', getMyConsentHistoryController);

/**
 * Les demandes d'exercice de droits du patient connecte (EF-12-09).
 *
 * Deposer une demande est un droit : la route est ouverte au patient, et c'est
 * l'administration nationale qui la traite, sur son propre ecran. Rien n'est
 * execute automatiquement — un effacement de dossier de soins se decide, il ne
 * se declenche pas.
 */
router.get('/me/demandes-rgpd', async (req: AuthRequest, res: Response) => {
  const data = await rgpd.mesDemandes(req.user!.userId);
  res.json({ success: true, data });
});

router.post('/me/demandes-rgpd', validateBody(deposerDemandeRgpdSchema), async (req: AuthRequest, res: Response) => {
  const data = await rgpd.deposer(req.user!.userId, req.body.type, req.body.precision);
  res.status(201).json({
    success: true,
    data,
    message: `Demande enregistree. Une reponse vous sera apportee au plus tard le ${new Date(data.dateLimite).toLocaleDateString('fr-FR')}.`,
  });
});

export default router;

import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';
import { validateBody, validateQuery } from '../middlewares/validate.middleware';
import * as rgpd from '../services/rgpd.service';
import { filtreDemandesRgpdSchema, repondreDemandeRgpdSchema } from '../validators/api.schemas';
import type {
  DemandeRgpdView, FileDemandesView, StatutDemandeRgpd, TypeDemandeRgpd,
} from '@baobaoheath/shared-types';

/**
 * Le traitement des demandes d'exercice de droits (EF-12-09).
 *
 * Reserve a l'administration nationale : une demande RGPD engage le
 * responsable de traitement, pas un etablissement.
 *
 * **Rien n'est execute automatiquement ici.** Ni effacement, ni rectification
 * d'un dossier de soins : ces actes ont des consequences legales et se
 * decident. Ce routeur enregistre, fait suivre, et oblige a repondre par
 * ecrit. Voir la note du service pour ce que « effacement » peut vouloir dire
 * sur un dossier de soins.
 */
const router = Router();

router.use(authenticate);
router.use(requireRole('ADMIN_NATIONAL', 'SUPER_ADMIN'));

/** La file, les ouvertes d'abord puis la plus urgente. */
router.get('/', validateQuery(filtreDemandesRgpdSchema), async (req: AuthRequest, res: Response) => {
  const q = req.query as { statut?: StatutDemandeRgpd; type?: TypeDemandeRgpd };
  const data: FileDemandesView = await rgpd.file(q);
  res.json({ success: true, data });
});

/** Se declarer en charge. Deux agents ne peuvent pas prendre la meme. */
router.post('/:id/prendre-en-charge', async (req: AuthRequest, res: Response) => {
  const data: DemandeRgpdView = await rgpd.prendreEnCharge(req.user!.userId, req.params['id'] as string);
  res.json({ success: true, data, message: 'Demande prise en charge.' });
});

/**
 * Clore la demande.
 *
 * La reponse est obligatoire dans les deux cas : un refus qu'on ne motive pas
 * n'est pas contestable, et une demande satisfaite doit dire ce qui a ete
 * fait. Une contrainte SQL le verifie aussi.
 */
router.post('/:id/repondre', validateBody(repondreDemandeRgpdSchema), async (req: AuthRequest, res: Response) => {
  const data: DemandeRgpdView = await rgpd.repondre(
    req.user!.userId,
    req.params['id'] as string,
    req.body.satisfaite as boolean,
    req.body.reponse as string
  );
  res.json({
    success: true,
    data,
    message: data.statut === 'SATISFAITE' ? 'Demande satisfaite.' : 'Demande refusee, avec son motif.',
  });
});

export default router;

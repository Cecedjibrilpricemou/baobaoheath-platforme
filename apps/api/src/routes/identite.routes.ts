import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';
import { validateBody, validateQuery } from '../middlewares/validate.middleware';
import * as identite from '../services/identite.service';
import * as doublon from '../services/doublon.service';
import {
  filtreIdentitesSchema, noterTraitsSchema, verifierIdentiteSchema,
} from '../validators/api.schemas';
import type { IdentitePatientView, NiveauIdentite } from '@baobaoheath/shared-types';

/**
 * Verification d'identite au comptoir (EF-01-04/10).
 *
 * Reserve a l'accueil et a l'administration de structure. Ce n'est ni un acte
 * medical ni un acte d'administration nationale : c'est le geste de celui qui
 * recoit le patient et regarde sa piece.
 *
 * **Ce que ces routes ouvrent** : le tiers payant, et plus tard la delivrance
 * de produits reglementes. **Pas les soins** — un patient a l'identite
 * provisoire est consulte, suivi et prescrit normalement.
 */
const router = Router();

router.use(authenticate);
router.use(requireRole('AGENT_ACCUEIL', 'ADMIN_STRUCTURE'));

/**
 * Les doublons possibles d'un dossier (EF-01-05).
 *
 * **Ce ne sont pas des verdicts.** Aucune fusion n'est automatique : un agent
 * decide. Fusionner deux personnes distinctes melange leurs dossiers
 * medicaux, ce qui est bien plus dangereux que de laisser un doublon.
 *
 * Declaree avant `/:id/...` pour rester lisible.
 */
router.get('/:id/doublons', async (req: AuthRequest, res: Response) => {
  const data = await doublon.pourPatient(req.params['id'] as string);
  // Un dossier introuvable n'a pas « aucun doublon » : il n'existe pas. Rendre
  // une liste vide ferait lire a l'agent une affirmation fausse.
  if (data === null) {
    res.status(404).json({ success: false, error: 'Dossier patient introuvable' });
    return;
  }
  res.json({ success: true, data });
});

/** Les patients et leur identite. Les provisoires d'abord : c'est le travail. */
router.get('/', validateQuery(filtreIdentitesSchema), async (req: AuthRequest, res: Response) => {
  const q = req.query as { q?: string; niveau?: NiveauIdentite };
  const data: IdentitePatientView[] = await identite.rechercher(q);
  res.json({ success: true, data });
});

/**
 * Enregistrer une piece vue.
 *
 * L'agent declare avoir vu le document et dit lequel. Le numero est exige :
 * une verification qui ne peut pas nommer le document sur lequel elle se fonde
 * n'est ni verifiable ni contestable.
 */
router.post('/:id/verifier', validateBody(verifierIdentiteSchema), async (req: AuthRequest, res: Response) => {
  const data = await identite.verifier(req.user!, req.params['id'] as string, req.body);
  res.json({
    success: true,
    data,
    message: `Identite de ${data.nomComplet} verifiee. Le tiers payant est desormais ouvert pour ce patient.`,
  });
});

/**
 * Noter un trait distinctif sans verifier.
 *
 * Au telephone ou sur declaration, un agent peut recueillir le lieu de
 * naissance et le nom de la mere sans piece. Ces traits servent la detection
 * de doublons, qui n'attend pas une verification pour etre utile.
 */
router.post('/:id/traits', validateBody(noterTraitsSchema), async (req: AuthRequest, res: Response) => {
  const data = await identite.noterTraits(req.params['id'] as string, req.body);
  res.json({ success: true, data, message: 'Traits distinctifs enregistres.' });
});

export default router;

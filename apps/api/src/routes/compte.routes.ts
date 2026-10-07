import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';
import { validateBody, validateQuery } from '../middlewares/validate.middleware';
import * as comptes from '../services/compte.service';
import {
  filtreComptesSchema, suspendreCompteSchema, verifierOrdreSchema,
} from '../validators/api.schemas';
import type { CompteView, Role, SuspensionView } from '@baobaoheath/shared-types';

/**
 * Suspension et reactivation des comptes (EF-12-01).
 *
 * Reserve a l'administration nationale. Un administrateur de structure dispose
 * deja de `desactiverAgent`, borne a ses propres agents ; ici il s'agit de
 * pouvoir fermer n'importe quel compte de la plateforme, ce qui est une
 * responsabilite d'un autre ordre.
 *
 * Ces routes sont journalisees par la regle large de `shouldAudit` (toute
 * methode POST l'est), et c'est voulu : une suspension doit laisser une trace
 * consultable depuis l'ecran du journal d'audit.
 */
const router = Router();

router.use(authenticate);
router.use(requireRole('ADMIN_NATIONAL', 'SUPER_ADMIN'));

/** La liste des comptes, pour trouver celui qu'on cherche. */
router.get('/', validateQuery(filtreComptesSchema), async (req: AuthRequest, res: Response) => {
  const q = req.query as { q?: string; role?: Role; actifs?: boolean; page?: number; limit?: number };
  const data = await comptes.rechercher(q);
  res.json({ success: true, data });
});

/**
 * Fermer un compte.
 *
 * Le motif est obligatoire et long d'au moins dix caracteres : une suspension
 * coupe un soignant de ses patients, et une mesure qu'on ne peut pas
 * expliquer ne peut pas etre contestee.
 *
 * La reponse dit **ce qui a reellement ete coupe** — sessions supprimees,
 * sockets fermes — plutot qu'un simple « fait ». « Immediate » est le mot du
 * cahier des charges ; il faut pouvoir le verifier.
 */
router.post('/:id/suspendre', validateBody(suspendreCompteSchema), async (req: AuthRequest, res: Response) => {
  const data: SuspensionView = await comptes.suspendre(
    { userId: req.user!.userId, role: req.user!.role },
    req.params['id'] as string,
    req.body.motif as string
  );
  res.json({
    success: true,
    data,
    message: `Compte ferme. ${data.sessionsFermees} session(s) et ${data.socketsFermes} connexion(s) temps reel coupees.`,
  });
});

/**
 * Rouvrir un compte.
 *
 * La fiche ne garde aucune trace de la suspension levee — une contrainte SQL
 * l'exige, et un compte actif affichant encore un motif de suspension serait
 * trompeur. **Le journal d'audit garde l'histoire** : il est en ajout seul.
 */
router.post('/:id/reactiver', async (req: AuthRequest, res: Response) => {
  const data: SuspensionView = await comptes.reactiver(
    { userId: req.user!.userId, role: req.user!.role },
    req.params['id'] as string
  );
  res.json({ success: true, data, message: 'Compte reactive.' });
});

/**
 * Verifier le numero d'ordre d'un professionnel (EF-01-08).
 *
 * **Une declaration d'administrateur, pas un appel a une API** : il n'existe
 * pas de registre national interrogeable. Un humain confronte le numero au
 * registre de l'ordre, et son nom reste attache a cette verification.
 *
 * Tant qu'elle n'a pas eu lieu, le compte ne peut pas etre active.
 */
router.post('/:id/verifier-ordre', validateBody(verifierOrdreSchema), async (req: AuthRequest, res: Response) => {
  const data = await comptes.verifierOrdre(
    { userId: req.user!.userId, role: req.user!.role },
    req.params['id'] as string,
    (req.body as { numeroOrdre: string }).numeroOrdre
  );
  res.json({
    success: true,
    data,
    message: `Numero d'ordre de ${data.nomComplet} verifie. Le compte peut etre active.`,
  });
});

export default router;

/** Reexporte pour que le typage de la liste reste lie au contrat. */
export type { CompteView };

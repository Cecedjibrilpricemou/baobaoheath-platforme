import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import * as course from '../services/course.service';
import {
  choisirOffreCourseSchema,
  confirmerReceptionCourseSchema,
  proposerOffreCourseSchema,
  remettreAuMotardSchema,
  renoncerLivraisonSchema,
} from '../validators/api.schemas';

const router = Router();

router.use(authenticate);

router.get('/ouvertes', requireRole('LIVREUR'), async (req: AuthRequest, res: Response) => {
  const data = await course.coursesOuvertesPour(req.user!);
  res.json({ success: true, data });
});

router.get('/mes-courses', requireRole('LIVREUR'), async (req: AuthRequest, res: Response) => {
  const data = await course.coursesDuLivreur(req.user!);
  res.json({ success: true, data });
});

router.get(
  '/commande/:idCommande/offres',
  requireRole('PATIENT'),
  async (req: AuthRequest, res: Response) => {
    const data = await course.offresDeMaCommande(req.user!, String(req.params['idCommande']));
    res.json({ success: true, data });
  },
);

router.post(
  '/:id/offres',
  requireRole('LIVREUR'),
  validateBody(proposerOffreCourseSchema),
  async (req: AuthRequest, res: Response) => {
    const data = await course.proposer(req.user!, String(req.params['id']), req.body);
    res.json({ success: true, data, message: 'Offre enregistree' });
  },
);

router.post(
  '/commande/:idCommande/choisir',
  requireRole('PATIENT'),
  validateBody(choisirOffreCourseSchema),
  async (req: AuthRequest, res: Response) => {
    const data = await course.choisirOffre(
      req.user!,
      String(req.params['idCommande']),
      req.body.idOffre,
    );
    res.json({ success: true, data, message: 'Offre choisie' });
  },
);

router.post(
  '/:id/recu',
  requireRole('PATIENT'),
  validateBody(confirmerReceptionCourseSchema),
  async (req: AuthRequest, res: Response) => {
    const data = await course.declarerRecu(req.user!, String(req.params['id']));
    res.json({ success: true, data, message: 'Reception declaree, commande cloturee' });
  },
);

router.post(
  '/:id/renoncer',
  requireRole('PATIENT'),
  validateBody(renoncerLivraisonSchema),
  async (req: AuthRequest, res: Response) => {
    const data = await course.renoncerALaLivraison(
      req.user!,
      String(req.params['id']),
      req.body.motif,
    );
    res.json({ success: true, data, message: 'Commande repassee au retrait en pharmacie' });
  },
);

router.post(
  '/:id/remettre',
  requireRole('PHARMACIEN'),
  validateBody(remettreAuMotardSchema),
  async (req: AuthRequest, res: Response) => {
    const data = await course.remettreAuMotard(
      req.user!,
      String(req.params['id']),
      req.body.qrCodeScanne,
    );
    res.json({ success: true, data, message: 'Produits remis au motard attribue' });
  },
);

export default router;

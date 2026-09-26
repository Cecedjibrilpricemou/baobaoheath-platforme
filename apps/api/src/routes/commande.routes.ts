// src/routes/commande.routes.ts
// P6 / EF-07 — appel aux pharmacies et attribution de la commande.
// Processus : docs/PARCOURS-COMMANDE-LIVRAISON.md
import { Router, Response } from 'express';

import { authenticate, AuthRequest } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import * as commande from '../services/commande.service';
import {
  choisirModeRemiseSchema,
  lancerRechercheSchema,
  repondreDisponibiliteSchema,
  retirerPriseEnChargeSchema,
} from '../validators/api.schemas';

const router = Router();

router.use(authenticate);

/**
 * Lance la recherche d'une pharmacie pour une ordonnance signee. Ouvert au
 * prescripteur et a l'accueil : ce sont eux qui cloturent le passage a
 * l'hopital.
 */
router.post(
  '/',
  requireRole('MEDECIN', 'ASC', 'ASC_SUPERVISOR', 'AGENT_ACCUEIL'),
  validateBody(lancerRechercheSchema),
  async (req: AuthRequest, res: Response) => {
    const data = await commande.lancerRecherchePharmacie(req.body.idOrdonnance);
    res.status(201).json({ success: true, data });
  }
);

/** La file du comptoir : les appels du quartier, et ce que la pharmacie a pris. */
router.get('/pharmacie', requireRole('PHARMACIEN'), async (req: AuthRequest, res: Response) => {
  const data = await commande.commandesDeLaPharmacie(req.user!);
  res.json({ success: true, data });
});

/**
 * Reponse a l'appel. `aTousLesProduits: true` tente de prendre la commande —
 * l'attribution est atomique, un seul gagnant.
 */
router.post(
  '/:id/disponibilite',
  requireRole('PHARMACIEN'),
  validateBody(repondreDisponibiliteSchema),
  async (req: AuthRequest, res: Response) => {
    const data = await commande.repondreDisponibilite(
      req.user!,
      String(req.params.id),
      req.body.aTousLesProduits
    );
    res.json({ success: true, data });
  }
);

/** La pharmacie rend la commande : le verrou se rouvre pour les autres. */
router.post(
  '/:id/retirer',
  requireRole('PHARMACIEN'),
  validateBody(retirerPriseEnChargeSchema),
  async (req: AuthRequest, res: Response) => {
    const data = await commande.retirerPriseEnCharge(req.user!, String(req.params.id), req.body.motif);
    res.json({ success: true, data });
  }
);

/** Le patient choisit retrait ou livraison. La livraison n'est jamais imposee. */
router.post(
  '/:id/mode-remise',
  requireRole('PATIENT'),
  validateBody(choisirModeRemiseSchema),
  async (req: AuthRequest, res: Response) => {
    const data = await commande.choisirModeRemise(req.user!, String(req.params.id), req.body.mode);
    res.json({ success: true, data });
  }
);

router.get('/:id', async (req: AuthRequest, res: Response) => {
  const data = await commande.getCommande(String(req.params.id));
  res.json({ success: true, data });
});

export default router;

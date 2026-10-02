import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import * as assurance from '../services/assurance.service';
import {
  creerAssureurSchema,
  creerContratAssuranceSchema,
  creerRegleCouvertureSchema,
  simulerPriseEnChargeSchema,
  verifierEligibiliteSchema,
} from '../validators/api.schemas';
import type {
  AssureurView,
  ContratAssuranceView,
  ControleEligibiliteView,
  PriseEnChargeView,
} from '@baobaoheath/shared-types';

/**
 * Assurance et tiers payant (EF-09, addendum du 2026-09-28 point 5).
 *
 * Deux publics, deux niveaux de droits :
 *
 *   - **le comptoir** (pharmacie, accueil) controle l'eligibilite et chiffre
 *     une prise en charge. Il ne cree ni assureur ni contrat ;
 *   - **l'administration nationale** saisit les assureurs, leurs regles de
 *     couverture et les contrats, tant que les echanges automatiques avec les
 *     assureurs (EF-09-02) ne sont pas conventionnes.
 */
const router = Router();

router.use(authenticate);

// ── Le comptoir ──────────────────────────────────────────────────────

/**
 * Controle d'eligibilite. La reponse est **enregistree** : c'est elle qui
 * justifiera le tiers payant si l'assureur le conteste (point 5.1).
 */
router.post(
  '/eligibilite',
  requireRole('PHARMACIEN', 'AGENT_ACCUEIL', 'ADMIN_STRUCTURE'),
  validateBody(verifierEligibiliteSchema),
  async (req: AuthRequest, res: Response) => {
    const data: ControleEligibiliteView = await assurance.verifierEligibilite(req.user!, req.body.idPatient);
    res.status(201).json({ success: true, data });
  }
);

router.get(
  '/patients/:id/eligibilite',
  requireRole('PHARMACIEN', 'AGENT_ACCUEIL', 'ADMIN_STRUCTURE'),
  async (req: AuthRequest, res: Response) => {
    const data: ControleEligibiliteView[] = await assurance.historiqueEligibilite(
      req.user!,
      req.params['id'] as string
    );
    res.json({ success: true, data });
  }
);

/**
 * Chiffre une prise en charge **sans rien enregistrer**, pour que le comptoir
 * la montre avant le paiement : « un reste a charge sans explication se
 * conteste au comptoir » (point 5.4).
 */
router.post(
  '/simulation',
  requireRole('PHARMACIEN', 'AGENT_ACCUEIL'),
  validateBody(simulerPriseEnChargeSchema),
  async (req: AuthRequest, res: Response) => {
    const data: PriseEnChargeView = await assurance.simulerPriseEnCharge(
      req.user!,
      req.body.idPatient,
      req.body.lignes,
      req.body.montantNetGnf
    );
    res.json({ success: true, data });
  }
);

router.get(
  '/patients/:id/contrats',
  requireRole('PHARMACIEN', 'AGENT_ACCUEIL', 'ADMIN_STRUCTURE', 'ADMIN_NATIONAL', 'SUPER_ADMIN'),
  async (req: AuthRequest, res: Response) => {
    const data: ContratAssuranceView[] = await assurance.contratsDuPatient(req.params['id'] as string);
    res.json({ success: true, data });
  }
);

// ── L'administration ─────────────────────────────────────────────────

router.get(
  '/assureurs',
  requireRole('ADMIN_NATIONAL', 'SUPER_ADMIN', 'PHARMACIEN'),
  async (_req: AuthRequest, res: Response) => {
    const data: AssureurView[] = await assurance.listerAssureurs();
    res.json({ success: true, data });
  }
);

router.post(
  '/assureurs',
  requireRole('ADMIN_NATIONAL', 'SUPER_ADMIN'),
  validateBody(creerAssureurSchema),
  async (req: AuthRequest, res: Response) => {
    const data: AssureurView = await assurance.creerAssureur(req.body);
    res.status(201).json({ success: true, data, message: `Assureur ${data.code} cree` });
  }
);

/**
 * Ajoute une regle de couverture. Elle ne remplace pas la precedente : sa
 * date d'effet decide, et le calcul retient celle en vigueur a la date de la
 * vente (EF-09-03).
 */
router.post(
  '/assureurs/:id/regles',
  requireRole('ADMIN_NATIONAL', 'SUPER_ADMIN'),
  validateBody(creerRegleCouvertureSchema),
  async (req: AuthRequest, res: Response) => {
    const data: AssureurView = await assurance.ajouterRegle(req.params['id'] as string, req.body);
    res.status(201).json({ success: true, data, message: 'Regle de couverture ajoutee' });
  }
);

router.post(
  '/contrats',
  requireRole('ADMIN_NATIONAL', 'SUPER_ADMIN'),
  validateBody(creerContratAssuranceSchema),
  async (req: AuthRequest, res: Response) => {
    const data: ContratAssuranceView = await assurance.creerContrat(req.body);
    res.status(201).json({ success: true, data, message: `Police ${data.numeroPolice} enregistree` });
  }
);

export default router;

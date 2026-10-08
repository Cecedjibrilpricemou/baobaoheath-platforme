import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import * as assurance from '../services/assurance.service';
import {
  creerAgentAssureurSchema,
  creerAssureurSchema,
  creerReglementSchema,
  creerContratAssuranceSchema,
  creerRegleCouvertureSchema,
  simulerPriseEnChargeSchema,
  verifierEligibiliteSchema,
} from '../validators/api.schemas';
import type {
  AgentAssureurCreeView,
  AssureView,
  AssureurView,
  MonAssureurView,
  PatientContratRechercheView,
  ReglementView,
  SituationPharmacieView,
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

/**
 * Trouver le patient a qui rattacher une police.
 *
 * **Reserve a l'administration** : le comptoir reconnait le patient par son
 * QR, il est devant lui. Ici l'assureur envoie une liste de noms, et il faut
 * chercher a l'echelle du pays — donc hors de toute structure.
 */
router.get(
  '/patients/recherche',
  requireRole('ADMIN_NATIONAL', 'SUPER_ADMIN'),
  async (req: AuthRequest, res: Response) => {
    const q = typeof req.query['q'] === 'string' ? req.query['q'] : '';
    const data: PatientContratRechercheView[] = await assurance.rechercherPatientsPourContrat(q);
    res.json({ success: true, data });
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

/**
 * Creer le compte par lequel un assureur se connecte.
 *
 * Sa structure de type ASSURANCE est creee a la volee si la compagnie n'en a
 * pas : sans elle, ses agents heriteraient des droits d'une pharmacie ou d'un
 * etablissement de soins, et donc d'un acces aux dossiers.
 */
router.post(
  '/assureurs/:id/agents',
  requireRole('ADMIN_NATIONAL', 'SUPER_ADMIN'),
  validateBody(creerAgentAssureurSchema),
  async (req: AuthRequest, res: Response) => {
    const data: AgentAssureurCreeView = await assurance.creerAgentAssureur(
      req.user!, req.params['id'] as string, req.body,
    );
    res.status(201).json({
      success: true,
      data,
      message: `Compte de ${data.agent.prenom} ${data.agent.nom} cree pour ${data.assureur.nom}. `
        + `Remettez-lui son mot de passe : il devra le changer a sa premiere connexion.`,
    });
  }
);

// ── L'espace de l'assureur (addendum, point 5.2) ─────────────────────
//
// **Aucune de ces routes ne prend d'identifiant de compagnie.** Elle se deduit
// de la structure de l'agent connecte : l'accepter en parametre laisserait un
// agent de la SONAG lire la situation d'un concurrent en changeant un chiffre
// dans l'URL.
//
// **Rien de medical n'en sort.** Des montants, des comptes et des noms
// d'assures — jamais un produit delivre ni une ordonnance. Un assureur qui
// lirait ce qu'on soigne pourrait refuser un contrat dessus.

router.get('/moi', requireRole('ASSUREUR'), async (req: AuthRequest, res: Response) => {
  const data: MonAssureurView = await assurance.monAssureur(req.user!);
  res.json({ success: true, data });
});

router.get('/moi/assures', requireRole('ASSUREUR'), async (req: AuthRequest, res: Response) => {
  const data: AssureView[] = await assurance.mesAssures(req.user!);
  res.json({ success: true, data });
});

/**
 * La situation par officine : ce qui a ete delivre, ce qui est facture, ce qui
 * est paye, ce qui reste du.
 */
router.get('/moi/pharmacies', requireRole('ASSUREUR'), async (req: AuthRequest, res: Response) => {
  const data: SituationPharmacieView[] = await assurance.mesPharmacies(req.user!);
  res.json({ success: true, data });
});

router.get('/moi/reglements', requireRole('ASSUREUR'), async (req: AuthRequest, res: Response) => {
  const data: ReglementView[] = await assurance.mesReglements(req.user!);
  res.json({ success: true, data });
});

router.post(
  '/moi/reglements',
  requireRole('ASSUREUR'),
  validateBody(creerReglementSchema),
  async (req: AuthRequest, res: Response) => {
    const data: ReglementView = await assurance.enregistrerReglement(req.user!, req.body);
    res.status(201).json({
      success: true,
      data,
      message: `Versement de ${data.montantGnf.toLocaleString('fr-FR')} GNF enregistre pour ${data.structure.nom}.`,
    });
  }
);

export default router;

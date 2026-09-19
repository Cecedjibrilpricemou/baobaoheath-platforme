// src/routes/hopital.routes.ts
// P1 — Hopital (EF-03) : admission, episodes de soins, orientation, demandes
// d'analyse, tableau de bord. Reserve au personnel d'une structure.
import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';
import { validateBody, validateQuery } from '../middlewares/validate.middleware';
import * as hopital from '../services/hopital.service';
import {
  annulerDemandeSchema,
  createDemandeAnalyseSchema,
  createEpisodeSchema,
  episodesQuerySchema,
  orientationSchema,
  updateEpisodeSchema,
} from '../validators/api.schemas';
import type {
  DemandeAnalyseView,
  EpisodeSoinsView,
  ExamenView,
  PatientRechercheView,
  StructureRefView,
  TableauDeBordHopitalView,
} from '@baobaoheath/shared-types';

const router = Router();

router.use(authenticate);
router.use(requireRole('AGENT_ACCUEIL', 'MEDECIN', 'ADMIN_STRUCTURE'));

// Les erreurs metier (AppError) remontent au middleware global : pas de
// try/catch ici, Express 5 propage les rejets des handlers async.

// ── Tableau de bord (EF-03-07) ───────────────────────────────────────
router.get('/tableau-de-bord', async (req: AuthRequest, res: Response) => {
  const data: TableauDeBordHopitalView = await hopital.tableauDeBord(req.user!);
  res.json({ success: true, data });
});

// ── Recherche patient avant admission (EF-03-01) ─────────────────────
router.get('/patients/recherche', async (req: AuthRequest, res: Response) => {
  const q = typeof req.query['q'] === 'string' ? req.query['q'] : '';
  const data: PatientRechercheView[] = await hopital.rechercherPatients(req.user!, q);
  res.json({ success: true, data });
});

// ── Referentiels ─────────────────────────────────────────────────────
router.get('/examens', async (req: AuthRequest, res: Response) => {
  const q = typeof req.query['q'] === 'string' ? req.query['q'] : undefined;
  const categorie = typeof req.query['categorie'] === 'string' ? req.query['categorie'] : undefined;
  const data: ExamenView[] = await hopital.listerExamens(q, categorie);
  res.json({ success: true, data });
});

router.get('/laboratoires', async (_req: AuthRequest, res: Response) => {
  const data: StructureRefView[] = await hopital.listerLaboratoires();
  res.json({ success: true, data });
});

router.get('/medecins', async (req: AuthRequest, res: Response) => {
  const data = await hopital.listerMedecinsDeLaStructure(req.user!);
  res.json({ success: true, data });
});

// ── Episodes de soins (EF-03-02, EF-03-05) ───────────────────────────
router.get('/episodes', validateQuery(episodesQuerySchema), async (req: AuthRequest, res: Response) => {
  const { statut, q, page, limit } = req.query as { statut?: string; q?: string; page?: number; limit?: number };
  const data = await hopital.listerEpisodes(req.user!, { statut, q, page: page ?? 1, limit: limit ?? 20 });
  res.json({ success: true, data });
});

router.post('/episodes', validateBody(createEpisodeSchema), async (req: AuthRequest, res: Response) => {
  const data: EpisodeSoinsView = await hopital.creerEpisode(req.user!, req.body);
  res.status(201).json({ success: true, data });
});

router.get('/episodes/:id', async (req: AuthRequest, res: Response) => {
  const data: EpisodeSoinsView = await hopital.getEpisode(req.user!, req.params['id'] as string);
  res.json({ success: true, data });
});

router.patch('/episodes/:id', validateBody(updateEpisodeSchema), async (req: AuthRequest, res: Response) => {
  const data: EpisodeSoinsView = await hopital.modifierEpisode(req.user!, req.params['id'] as string, req.body);
  res.json({ success: true, data });
});

router.post('/episodes/:id/cloturer', async (req: AuthRequest, res: Response) => {
  const data: EpisodeSoinsView = await hopital.cloturerEpisode(req.user!, req.params['id'] as string, false);
  res.json({ success: true, data });
});

router.post('/episodes/:id/annuler', async (req: AuthRequest, res: Response) => {
  const data: EpisodeSoinsView = await hopital.cloturerEpisode(req.user!, req.params['id'] as string, true);
  res.json({ success: true, data });
});

router.post('/episodes/:id/orientation', validateBody(orientationSchema), async (req: AuthRequest, res: Response) => {
  const data: EpisodeSoinsView = await hopital.orienter(req.user!, req.params['id'] as string, req.body);
  res.json({ success: true, data });
});

// ── Demandes d'analyse (EF-03-03, EF-03-04, EF-03-06) ────────────────
router.post('/episodes/:id/demandes-analyse', validateBody(createDemandeAnalyseSchema), async (req: AuthRequest, res: Response) => {
  const data: DemandeAnalyseView = await hopital.creerDemandeAnalyse(req.user!, req.params['id'] as string, req.body);
  res.status(201).json({ success: true, data });
});

router.get('/demandes-analyse/:id', async (req: AuthRequest, res: Response) => {
  const data: DemandeAnalyseView = await hopital.getDemandeAnalyse(req.user!, req.params['id'] as string);
  res.json({ success: true, data });
});

router.post('/demandes-analyse/:id/annuler', validateBody(annulerDemandeSchema), async (req: AuthRequest, res: Response) => {
  const data: DemandeAnalyseView = await hopital.annulerDemandeAnalyse(req.user!, req.params['id'] as string, req.body.motif);
  res.json({ success: true, data });
});

// Bon d'examen imprimable (HTML pret pour window.print).
router.get('/demandes-analyse/:id/document', async (req: AuthRequest, res: Response) => {
  const html = await hopital.documentDemandeAnalyse(req.user!, req.params['id'] as string);
  res.type('html').send(html);
});

export default router;

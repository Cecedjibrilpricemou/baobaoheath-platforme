// src/routes/laboratoire.routes.ts
// P2 — Laboratoire (EF-04) : file des demandes, prelevement, resultats,
// validation du biologiste, compte rendu. Reserve au personnel du laboratoire.
import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';
import { validateBody, validateQuery } from '../middlewares/validate.middleware';
import * as labo from '../services/laboratoire.service';
import {
  enregistrerPrelevementSchema,
  fileLaboQuerySchema,
  planifierPrelevementSchema,
  saisirResultatsSchema,
  validerResultatsSchema,
} from '../validators/api.schemas';
import type { DemandeAnalyseView, TableauDeBordLaboView } from '@baobaoheath/shared-types';

const router = Router();

router.use(authenticate);
router.use(requireRole('TECHNICIEN_LABO', 'BIOLOGISTE', 'ADMIN_STRUCTURE'));

router.get('/tableau-de-bord', async (req: AuthRequest, res: Response) => {
  const data: TableauDeBordLaboView = await labo.tableauDeBord(req.user!);
  res.json({ success: true, data });
});

// ── File des demandes (EF-04-01) ──────────────────────────────────────
router.get('/demandes', validateQuery(fileLaboQuerySchema), async (req: AuthRequest, res: Response) => {
  const { statut, q, page, limit } = req.query as { statut?: string; q?: string; page?: number; limit?: number };
  const data = await labo.fileDesDemandes(req.user!, { statut, q, page: page ?? 1, limit: limit ?? 20 });
  res.json({ success: true, data });
});

router.get('/demandes/:id', async (req: AuthRequest, res: Response) => {
  const data: DemandeAnalyseView = await labo.getDemande(req.user!, req.params['id'] as string);
  res.json({ success: true, data });
});

router.post('/demandes/:id/reception', async (req: AuthRequest, res: Response) => {
  const data = await labo.accuserReception(req.user!, req.params['id'] as string);
  res.json({ success: true, data });
});

// ── Prelevement (EF-04-02, EF-04-03) ──────────────────────────────────
router.post('/demandes/:id/prelevement/planifier', validateBody(planifierPrelevementSchema), async (req: AuthRequest, res: Response) => {
  const data = await labo.planifierPrelevement(req.user!, req.params['id'] as string, req.body);
  res.json({ success: true, data });
});

router.post('/demandes/:id/prelevement', validateBody(enregistrerPrelevementSchema), async (req: AuthRequest, res: Response) => {
  const data = await labo.enregistrerPrelevement(req.user!, req.params['id'] as string, req.body);
  res.status(201).json({ success: true, data });
});

// ── Resultats : saisie ou import (EF-04-04, EF-04-06) ─────────────────
router.put('/demandes/:id/resultats', validateBody(saisirResultatsSchema), async (req: AuthRequest, res: Response) => {
  const data = await labo.saisirResultats(req.user!, req.params['id'] as string, req.body);
  res.json({ success: true, data });
});

// ── Validation nominative du biologiste (EF-04-05) ────────────────────
router.post('/demandes/:id/valider', requireRole('BIOLOGISTE'), validateBody(validerResultatsSchema), async (req: AuthRequest, res: Response) => {
  const data = await labo.validerResultats(req.user!, req.params['id'] as string, req.body);
  res.json({ success: true, data });
});

// ── Compte rendu imprimable ───────────────────────────────────────────
router.get('/demandes/:id/compte-rendu', async (req: AuthRequest, res: Response) => {
  const html = await labo.compteRenduLabo(req.user!, req.params['id'] as string);
  res.type('html').send(html);
});

export default router;

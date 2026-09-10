import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import * as service from '../services/admin-structure.service';
import type {
  AgentStructureView,
  CreationAgentView,
  CreationPharmacieView,
  CreationStructureView,
  StructureAdminView,
  StatsStructureView,
  StructurePubliqueView,
} from '@baobaoheath/shared-types';
import {
  createAgentStructureSchema,
  createPharmacieSchema,
  createStructureSchema,
  updateStructureSchema,
} from '../validators/api.schemas';

const router = Router();

router.get('/structures/publiques', async (_req: Request, res: Response) => {
  try {
    // Annotation = contrat : un champ retire du select casse ici, au lieu
    // de devenir undefined dans une liste deroulante.
    const data: StructurePubliqueView[] = await service.getStructuresPubliques();
    res.json({ success: true, data });
  } catch (e: unknown) {
    res.status(500).json({ success: false, error: e instanceof Error ? e.message : String(e) });
  }
});

router.use(authenticate);

router.get('/agents', requireRole('ADMIN_STRUCTURE'), async (req: AuthRequest, res: Response) => {
  try {
    const data: AgentStructureView[] = await service.getAgentsStructure(req.user!.userId);
    res.json({ success: true, data });
  } catch (e: unknown) {
    res.status(400).json({ success: false, error: e instanceof Error ? e.message : String(e) });
  }
});

router.post('/agents', requireRole('ADMIN_STRUCTURE'), validateBody(createAgentStructureSchema), async (req: AuthRequest, res: Response) => {
  try {
    const data: CreationAgentView = await service.creerAgent(req.user!.userId, req.body);
    res.status(201).json({ success: true, data });
  } catch (e: unknown) {
    res.status(400).json({ success: false, error: e instanceof Error ? e.message : String(e) });
  }
});

router.put('/agents/:id/desactiver', requireRole('ADMIN_STRUCTURE'), async (req: AuthRequest, res: Response) => {
  try {
    await service.desactiverAgent(req.user!.userId, String(req.params.id));
    res.json({ success: true, message: 'Agent desactive' });
  } catch (e: unknown) {
    res.status(400).json({ success: false, error: e instanceof Error ? e.message : String(e) });
  }
});

router.get('/stats', requireRole('ADMIN_STRUCTURE'), async (req: AuthRequest, res: Response) => {
  try {
    const data: StatsStructureView = await service.getStatsStructure(req.user!.userId);
    res.json({ success: true, data });
  } catch (e: unknown) {
    res.status(500).json({ success: false, error: e instanceof Error ? e.message : String(e) });
  }
});

router.get('/structures', requireRole('SUPER_ADMIN', 'ADMIN_NATIONAL'), async (_req: AuthRequest, res: Response) => {
  try {
    const data: StructureAdminView[] = await service.getStructures();
    res.json({ success: true, data });
  } catch (e: unknown) {
    res.status(500).json({ success: false, error: e instanceof Error ? e.message : String(e) });
  }
});

router.post('/structures', requireRole('SUPER_ADMIN'), validateBody(createStructureSchema), async (req: AuthRequest, res: Response) => {
  try {
    const data: CreationStructureView = await service.creerStructureAvecAdmin(req.body);
    res.status(201).json({ success: true, data });
  } catch (e: unknown) {
    res.status(400).json({ success: false, error: e instanceof Error ? e.message : String(e) });
  }
});

router.post('/pharmacies', requireRole('SUPER_ADMIN'), validateBody(createPharmacieSchema), async (req: AuthRequest, res: Response) => {
  try {
    const data: CreationPharmacieView = await service.creerPharmacieAvecPharmacien(req.body);
    res.status(201).json({ success: true, data });
  } catch (e: unknown) {
    res.status(400).json({ success: false, error: e instanceof Error ? e.message : String(e) });
  }
});

router.put('/structures/:id', requireRole('SUPER_ADMIN'), validateBody(updateStructureSchema), async (req: AuthRequest, res: Response) => {
  try {
    const data: StructureAdminView = await service.modifierStructure(String(req.params.id), req.body);
    res.json({ success: true, data });
  } catch (e: unknown) {
    res.status(400).json({ success: false, error: e instanceof Error ? e.message : String(e) });
  }
});

router.delete('/structures/:id', requireRole('SUPER_ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    await service.supprimerStructure(String(req.params.id));
    res.json({ success: true, message: 'Structure desactivee' });
  } catch (e: unknown) {
    res.status(400).json({ success: false, error: e instanceof Error ? e.message : String(e) });
  }
});

export default router;

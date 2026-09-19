import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { authenticate, AuthRequest } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import { uploadLogo } from '../middlewares/upload.middleware';
import { uploadLogoController } from '../controllers/upload.controller';
import { ValidationError } from '../utils/app-error';
import * as service from '../services/admin-structure.service';
import * as parametresService from '../services/parametres.service';
import type {
  AgentStructureView,
  CreationAgentView,
  CreationPharmacieView,
  CreationStructureView,
  ParametresSystemeView,
  StructureAdminView,
  StatsStructureView,
  StructurePubliqueView,
} from '@baobaoheath/shared-types';
import {
  createAgentStructureSchema,
  createPharmacieSchema,
  createStructureSchema,
  updateParametresSystemeSchema,
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

// ── Parametres globaux de la plateforme (page Parametres du super-admin) ──
router.get('/parametres', requireRole('SUPER_ADMIN'), async (_req: AuthRequest, res: Response) => {
  try {
    const data: ParametresSystemeView = await parametresService.getParametres();
    res.json({ success: true, data });
  } catch (e: unknown) {
    res.status(500).json({ success: false, error: e instanceof Error ? e.message : String(e) });
  }
});

router.put('/parametres', requireRole('SUPER_ADMIN'), validateBody(updateParametresSystemeSchema), async (req: AuthRequest, res: Response) => {
  try {
    const data: ParametresSystemeView = await parametresService.modifierParametres(req.user!.userId, req.body);
    res.json({ success: true, data });
  } catch (e: unknown) {
    res.status(400).json({ success: false, error: e instanceof Error ? e.message : String(e) });
  }
});

// Logo de la plateforme (champ multipart "logo") : redimensionne, enregistre
// dans Parametres > Identite, renvoie l'identite a jour.
router.post('/parametres/logo', requireRole('SUPER_ADMIN'), (req: AuthRequest, res: Response, next: NextFunction) => {
  uploadLogo(req, res, (err: unknown) => {
    if (err) {
      const message =
        err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE'
          ? 'Image trop volumineuse (2 Mo maximum).'
          : err instanceof Error ? err.message : 'Échec du téléversement.';
      next(new ValidationError(message));
      return;
    }
    next();
  });
}, uploadLogoController);

export default router;

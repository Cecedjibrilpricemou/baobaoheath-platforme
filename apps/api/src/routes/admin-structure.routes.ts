// src/routes/admin-structure.routes.ts
import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';
import * as service from '../services/admin-structure.service';

const router = Router();

// ── Route PUBLIQUE — avant authenticate ───────────────────────────
// Accessible par tous (patient, non connecté) pour choisir une structure
router.get('/structures/publiques', async (_req: Request, res: Response) => {
    try {
        const data = await service.getStructures();
        res.json({ success: true, data });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

// ── Toutes les routes suivantes nécessitent un token ──────────────
router.use(authenticate);

// ── ADMIN_STRUCTURE — gestion de ses agents ───────────────────────
router.get('/agents', requireRole('ADMIN_STRUCTURE'), async (req: AuthRequest, res: Response) => {
    try {
        const data = await service.getAgentsStructure(req.user!.userId);
        res.json({ success: true, data });
    } catch (e: any) { res.status(400).json({ success: false, error: e.message }); }
});

router.post('/agents', requireRole('ADMIN_STRUCTURE'), async (req: AuthRequest, res: Response) => {
    try {
        const data = await service.creerAgent(req.user!.userId, req.body);
        res.status(201).json({ success: true, data });
    } catch (e: any) { res.status(400).json({ success: false, error: e.message }); }
});

router.put('/agents/:id/desactiver', requireRole('ADMIN_STRUCTURE'), async (req: AuthRequest, res: Response) => {
    try {
        await service.desactiverAgent(req.user!.userId, req.params.id);
        res.json({ success: true, message: 'Agent désactivé' });
    } catch (e: any) { res.status(400).json({ success: false, error: e.message }); }
});

router.get('/stats', requireRole('ADMIN_STRUCTURE'), async (req: AuthRequest, res: Response) => {
    try {
        const data = await service.getStatsStructure(req.user!.userId);
        res.json({ success: true, data });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

// ── SUPER_ADMIN — gestion des structures ─────────────────────────
router.get('/structures', requireRole('SUPER_ADMIN', 'ADMIN_NATIONAL'), async (_req: AuthRequest, res: Response) => {
    try {
        const data = await service.getStructures();
        res.json({ success: true, data });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/structures', requireRole('SUPER_ADMIN'), async (req: AuthRequest, res: Response) => {
    try {
        const data = await service.creerStructureAvecAdmin(req.body);
        res.status(201).json({ success: true, data });
    } catch (e: any) { res.status(400).json({ success: false, error: e.message }); }
});

router.put('/structures/:id', requireRole('SUPER_ADMIN'), async (req: AuthRequest, res: Response) => {
    try {
        const data = await service.modifierStructure(req.params.id, req.body);
        res.json({ success: true, data });
    } catch (e: any) { res.status(400).json({ success: false, error: e.message }); }
});

router.delete('/structures/:id', requireRole('SUPER_ADMIN'), async (req: AuthRequest, res: Response) => {
    try {
        await service.supprimerStructure(req.params.id);
        res.json({ success: true, message: 'Structure désactivée' });
    } catch (e: any) { res.status(400).json({ success: false, error: e.message }); }
});

export default router;

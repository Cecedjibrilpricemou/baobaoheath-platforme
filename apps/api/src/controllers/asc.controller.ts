import { Response } from 'express';
import { Request as ExpressRequest } from 'express';
import * as ascService from '../services/asc.service';
import { AuthRequest } from '../middlewares/auth.middleware';
import type { RendezVousAscView, StockAscView } from '@baobaoheath/shared-types';

type RequestWithId = ExpressRequest<{ id: string }>;

// ─── Récupérer le profil ASC connecté ────────────────────
export async function getMyAscProfileController(
    req: AuthRequest,
    res: Response
): Promise<void> {
    const asc = await ascService.getMyAscProfile(req.user!.userId);
        res.status(200).json({ success: true, data: asc });
}

// ─── Mettre à jour le profil ASC ─────────────────────────
export async function updateAscProfileController(
    req: AuthRequest,
    res: Response
): Promise<void> {
    const asc = await ascService.updateAscProfile(req.user!.userId, req.body);
        res.status(200).json({ success: true, data: asc });
}

// ─── Patients de la zone de l'ASC ────────────────────────
export async function getAscPatientsController(
    req: AuthRequest,
    res: Response
): Promise<void> {
    const patients = await ascService.getAscPatients(req.user!.userId);
        res.status(200).json({ success: true, data: patients });
}

// ─── Planning de l'ASC ────────────────────────────────────
export async function getAscPlanningController(
    req: AuthRequest,
    res: Response
): Promise<void> {
    const planning: RendezVousAscView[] = await ascService.getAscPlanning(req.user!.userId);
        res.status(200).json({ success: true, data: planning });
}

// ─── Liste des stocks ─────────────────────────────────────
export async function getAscStocksController(
    req: AuthRequest,
    res: Response
): Promise<void> {
    const filters = {
            seuilAlerte: req.query.seuilAlerte === 'true',
            page: req.query.page ? parseInt(req.query.page as string) : undefined,
            limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
        };
        const result = await ascService.getAscStocks(req.user!.userId, filters);
        // Annotation = contrat avec l'ecran Stocks de l'agent.
        const data: StockAscView[] = result.data;
        res.status(200).json({ success: true, ...result, data });
}

// ─── Créer un stock ───────────────────────────────────────
export async function createStockController(
    req: AuthRequest,
    res: Response
): Promise<void> {
    const stock = await ascService.createStock(req.user!.userId, req.body);
        res.status(201).json({ success: true, data: stock });
}

// ─── Mettre à jour un stock ───────────────────────────────
export async function updateStockController(
    req: AuthRequest & { params: { id: string } },
    res: Response
): Promise<void> {
    const stock = await ascService.updateStock(
            req.user!.userId,
            req.params.id,
            req.body
        );
        res.status(200).json({ success: true, data: stock });
}

// ─── Rapport mensuel ──────────────────────────────────────
export async function getRapportMensuelController(
    req: AuthRequest,
    res: Response
): Promise<void> {
    const mois = parseInt(req.query.mois as string);
        const annee = parseInt(req.query.annee as string);

        if (!mois || !annee || mois < 1 || mois > 12) {
            res.status(400).json({
                success: false,
                error: 'Paramètres mois et annee requis (mois: 1-12)',
            });
            return;
        }

        const rapport = await ascService.getRapportMensuel(req.user!.userId, {
            mois,
            annee,
        });
        res.status(200).json({ success: true, data: rapport });
}
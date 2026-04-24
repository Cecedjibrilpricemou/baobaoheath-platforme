import { Response } from 'express';
import { Request as ExpressRequest } from 'express';
import * as paiementService from '../services/paiement.service';
import { AuthRequest } from '../middlewares/auth.middleware';

type RequestWithId = ExpressRequest<{ id: string }>;

// ─── Initier un paiement ──────────────────────────────────
export async function initierPaiementController(
    req: AuthRequest,
    res: Response
): Promise<void> {
    try {
        const facture = await paiementService.initierPaiement(
            req.user!.userId,
            req.body
        );
        res.status(201).json({ success: true, data: facture });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Erreur serveur';
        res.status(400).json({ success: false, error: message });
    }
}

// ─── Vérifier le statut d'un paiement ────────────────────
export async function verifierStatutPaiementController(
    req: AuthRequest & { params: { id: string } },
    res: Response
): Promise<void> {
    try {
        const facture = await paiementService.verifierStatutPaiement(
            req.user!.userId,
            req.params.id
        );
        res.status(200).json({ success: true, data: facture });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Erreur serveur';
        res.status(404).json({ success: false, error: message });
    }
}

// ─── Confirmer un paiement ────────────────────────────────
export async function confirmerPaiementController(
    req: AuthRequest & { params: { id: string } },
    res: Response
): Promise<void> {
    try {
        const facture = await paiementService.confirmerPaiement(
            req.params.id,
            req.body
        );
        res.status(200).json({ success: true, data: facture });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Erreur serveur';
        res.status(400).json({ success: false, error: message });
    }
}

// ─── Historique des paiements ─────────────────────────────
export async function getHistoriquePaiementsController(
    req: AuthRequest,
    res: Response
): Promise<void> {
    try {
        const filters = {
            statut: req.query.statut as string | undefined,
            modePaiement: req.query.modePaiement as any,
            page: req.query.page ? parseInt(req.query.page as string) : undefined,
            limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
        };
        const result = await paiementService.getHistoriquePaiements(
            req.user!.userId,
            filters
        );
        res.status(200).json({ success: true, ...result });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Erreur serveur';
        res.status(500).json({ success: false, error: message });
    }
}

// ─── Annuler un paiement ──────────────────────────────────
export async function annulerPaiementController(
    req: AuthRequest & { params: { id: string } },
    res: Response
): Promise<void> {
    try {
        const facture = await paiementService.annulerPaiement(
            req.user!.userId,
            req.params.id
        );
        res.status(200).json({ success: true, data: facture });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Erreur serveur';
        res.status(400).json({ success: false, error: message });
    }
}
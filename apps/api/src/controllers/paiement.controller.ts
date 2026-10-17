import { Response } from 'express';
import { Request as ExpressRequest } from 'express';
import * as paiementService from '../services/paiement.service';
import { versFactureView } from '../services/paiement.service';
import { AuthRequest } from '../middlewares/auth.middleware';
import { InvoiceStatus, ModePaiement } from '@baobaoheath/shared-types';

type RequestWithId = ExpressRequest<{ id: string }>;

// ─── Initier un paiement ──────────────────────────────────
export async function initierPaiementController(
    req: AuthRequest,
    res: Response
): Promise<void> {
    const facture = await paiementService.initierPaiement(
            req.user!.userId,
            req.body
        );
        res.status(201).json({ success: true, data: versFactureView(facture) });
}

// ─── Vérifier le statut d'un paiement ────────────────────
export async function verifierStatutPaiementController(
    req: AuthRequest & { params: { id: string } },
    res: Response
): Promise<void> {
    const facture = await paiementService.verifierStatutPaiement(
            req.user!.userId,
            req.params.id
        );
        res.status(200).json({ success: true, data: versFactureView(facture) });
}

// ─── Confirmer un paiement ────────────────────────────────
export async function confirmerPaiementController(
    req: AuthRequest & { params: { id: string } },
    res: Response
): Promise<void> {
    const facture = await paiementService.confirmerPaiement(
            req.user!,
            req.params.id,
            req.body
        );
        res.status(200).json({ success: true, data: versFactureView(facture) });
}

// ─── Historique des paiements ─────────────────────────────
export async function getHistoriquePaiementsController(
    req: AuthRequest,
    res: Response
): Promise<void> {
    const filters = {
            statut: typeof req.query.statut === 'string' ? req.query.statut as InvoiceStatus : undefined,
            modePaiement: typeof req.query.modePaiement === 'string' ? req.query.modePaiement as ModePaiement : undefined,
            page: req.query.page ? parseInt(req.query.page as string) : undefined,
            limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
        };
        const result = await paiementService.getHistoriquePaiements(
            req.user!.userId,
            filters
        );
        res.status(200).json({
            success: true,
            data: result.data.map(versFactureView),
            meta: result.meta,
        });
}

// ─── Ce qui reste a regler ────────────────────────────────
export async function aReglerController(
    req: AuthRequest,
    res: Response
): Promise<void> {
    const data = await paiementService.aRegler(req.user!.userId);
    res.status(200).json({ success: true, data });
}

// ─── Annuler un paiement ──────────────────────────────────
export async function annulerPaiementController(
    req: AuthRequest & { params: { id: string } },
    res: Response
): Promise<void> {
    const facture = await paiementService.annulerPaiement(
            req.user!.userId,
            req.params.id
        );
        res.status(200).json({ success: true, data: versFactureView(facture) });
}
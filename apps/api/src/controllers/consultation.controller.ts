import { Response } from 'express';
import { Request as ExpressRequest } from 'express';
import * as consultationService from '../services/consultation.service';
import { AuthRequest } from '../middlewares/auth.middleware';

// Type avec params id
type RequestWithId = ExpressRequest<{ id: string }>;

// ─── Ouvrir une nouvelle consultation ────────────────────
export async function createConsultationController(
    req: AuthRequest,
    res: Response
): Promise<void> {
    try {
        const { prisma } = await import('../config/prisma');
        const asc = await prisma.ascProfile.findUnique({
            where: { idUtilisateur: req.user!.userId },
        });

        if (!asc) {
            res.status(403).json({
                success: false,
                error: 'Profil ASC non trouvé',
            });
            return;
        }

        const consultation = await consultationService.createConsultation(
            req.body,
            asc.id
        );

        res.status(201).json({ success: true, data: consultation });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Erreur serveur';
        res.status(400).json({ success: false, error: message });
    }
}

// ─── Récupérer une consultation par ID ───────────────────
export async function getConsultationByIdController(
    req: RequestWithId,
    res: Response
): Promise<void> {
    try {
        const consultation = await consultationService.getConsultationById(
            req.params.id
        );
        res.status(200).json({ success: true, data: consultation });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Erreur serveur';
        res.status(404).json({ success: false, error: message });
    }
}

// ─── Liste des consultations ──────────────────────────────
export async function getConsultationsController(
    req: ExpressRequest,
    res: Response
): Promise<void> {
    try {
        const filters = {
            idPatient: req.query.idPatient as string | undefined,
            idAsc: req.query.idAsc as string | undefined,
            page: req.query.page ? parseInt(req.query.page as string) : undefined,
            limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
        };

        const result = await consultationService.getConsultations(filters);
        res.status(200).json({ success: true, ...result });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Erreur serveur';
        res.status(500).json({ success: false, error: message });
    }
}

// ─── Mettre à jour une consultation ──────────────────────
export async function updateConsultationController(
    req: RequestWithId,
    res: Response
): Promise<void> {
    try {
        const consultation = await consultationService.updateConsultation(
            req.params.id,
            req.body
        );
        res.status(200).json({ success: true, data: consultation });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Erreur serveur';
        res.status(400).json({ success: false, error: message });
    }
}

// ─── Saisir les constantes vitales ───────────────────────
export async function saveVitalsController(
    req: RequestWithId,
    res: Response
): Promise<void> {
    try {
        const vitals = await consultationService.saveVitals(
            req.params.id,
            req.body
        );
        res.status(200).json({ success: true, data: vitals });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Erreur serveur';
        res.status(400).json({ success: false, error: message });
    }
}

// ─── Clôturer une consultation ────────────────────────────
export async function completeConsultationController(
    req: RequestWithId,
    res: Response
): Promise<void> {
    try {
        const consultation = await consultationService.completeConsultation(
            req.params.id
        );
        res.status(200).json({ success: true, data: consultation });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Erreur serveur';
        res.status(400).json({ success: false, error: message });
    }
}

// ─── Ajouter un diagnostic ────────────────────────────────
export async function addDiagnosticController(
    req: RequestWithId,
    res: Response
): Promise<void> {
    try {
        const diagnostic = await consultationService.addDiagnostic(
            req.params.id,
            req.body
        );
        res.status(201).json({ success: true, data: diagnostic });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Erreur serveur';
        res.status(400).json({ success: false, error: message });
    }
}

// ─── Récupérer les diagnostics ────────────────────────────
export async function getDiagnosticsController(
    req: RequestWithId,
    res: Response
): Promise<void> {
    try {
        const diagnostics = await consultationService.getDiagnostics(req.params.id);
        res.status(200).json({ success: true, data: diagnostics });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Erreur serveur';
        res.status(500).json({ success: false, error: message });
    }
}

// ─── Ajouter une ordonnance ───────────────────────────────
export async function addOrdonnanceController(
    req: RequestWithId,
    res: Response
): Promise<void> {
    try {
        const ordonnance = await consultationService.addOrdonnance(
            req.params.id,
            req.body
        );
        res.status(201).json({ success: true, data: ordonnance });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Erreur serveur';
        res.status(400).json({ success: false, error: message });
    }
}

// ─── Créer un référencement ───────────────────────────────
export async function createReferralController(
    req: RequestWithId,
    res: Response
): Promise<void> {
    try {
        const referral = await consultationService.createReferral(
            req.params.id,
            req.body
        );
        res.status(201).json({ success: true, data: referral });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Erreur serveur';
        res.status(400).json({ success: false, error: message });
    }
}
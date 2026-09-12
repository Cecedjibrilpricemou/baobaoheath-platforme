import { Response } from 'express';
import * as notificationService from '../services/notification.service';
import { AuthRequest } from '../middlewares/auth.middleware';
import type { NotificationFilters } from '../types/notification.types';
import type {
    NotificationView,
    NotificationsNonLuesView,
    PaginatedData,
} from '@baobaoheath/shared-types';

// ─── Envoyer un SMS personnalisé ─────────────────────────
export async function envoyerSmsController(
    req: AuthRequest,
    res: Response
): Promise<void> {
    const result = await notificationService.envoyerSms(req.body);
        res.status(200).json({ success: true, data: result });
}

// ─── Envoyer rappel de rendez-vous ───────────────────────
export async function envoyerRappelRendezVousController(
    req: AuthRequest & { params: { id: string } },
    res: Response
): Promise<void> {
    const result = await notificationService.envoyerRappelRendezVous(
            req.params.id
        );
        res.status(200).json({ success: true, data: result });
}

// ─── Envoyer alerte stock critique ───────────────────────
export async function envoyerAlerteStockController(
    req: AuthRequest & { params: { id: string } },
    res: Response
): Promise<void> {
    const result = await notificationService.envoyerAlerteStock(
            req.params.id
        );
        res.status(200).json({ success: true, data: result });
}

// ─── Envoyer notification référencement ──────────────────
export async function envoyerNotificationReferencementController(
    req: AuthRequest & { params: { id: string } },
    res: Response
): Promise<void> {
    const { statut } = req.body;
        if (!statut || !['ACCEPTE', 'REFUSE'].includes(statut)) {
            res.status(400).json({
                success: false,
                error: 'Statut invalide — ACCEPTE ou REFUSE requis',
            });
            return;
        }
        const result = await notificationService.envoyerNotificationReferencement(
            req.params.id,
            statut
        );
        res.status(200).json({ success: true, data: result });
}

// ─── Envoyer rappel vaccination ───────────────────────────
export async function envoyerRappelVaccinationController(
    req: AuthRequest & { params: { id: string } },
    res: Response
): Promise<void> {
    const result = await notificationService.envoyerRappelVaccination(
            req.params.id
        );
        res.status(200).json({ success: true, data: result });
}

// ─── SMS en masse par préfecture ──────────────────────────
export async function envoyerSmsMasseController(
    req: AuthRequest,
    res: Response
): Promise<void> {
    const { prefecture, message } = req.body;
        if (!prefecture || !message) {
            res.status(400).json({
                success: false,
                error: 'Prefecture et message requis',
            });
            return;
        }
        const result = await notificationService.envoyerSmsMasse(
            prefecture,
            message
        );
        res.status(200).json({ success: true, data: result });
}

// ─── Vérifier les rappels à envoyer ──────────────────────
export async function verifierRappelsController(
    req: AuthRequest,
    res: Response
): Promise<void> {
    const result = await notificationService.verifierRappelsAEnvoyer();
        res.status(200).json({ success: true, data: result });
}

// ─── Notifications in-app de l'utilisateur connecté ──────
export async function getMesNotificationsController(
    req: AuthRequest,
    res: Response
): Promise<void> {
    // req.query est deja valide/transforme par notificationsQuerySchema
    const filters = req.query as unknown as NotificationFilters;
    const data: PaginatedData<NotificationView> =
        await notificationService.getMesNotifications(req.user!.userId, filters);
    res.status(200).json({ success: true, data });
}

export async function compterNonLuesController(
    req: AuthRequest,
    res: Response
): Promise<void> {
    const data: NotificationsNonLuesView = {
        nonLues: await notificationService.compterNonLues(req.user!.userId),
    };
    res.status(200).json({ success: true, data });
}

export async function marquerLueController(
    req: AuthRequest & { params: { id: string } },
    res: Response
): Promise<void> {
    const data: NotificationView = await notificationService.marquerLue(
        req.user!.userId,
        req.params.id
    );
    res.status(200).json({ success: true, data });
}

export async function toutMarquerLuController(
    req: AuthRequest,
    res: Response
): Promise<void> {
    const marquees = await notificationService.toutMarquerLu(req.user!.userId);
    res.status(200).json({ success: true, data: { marquees } });
}
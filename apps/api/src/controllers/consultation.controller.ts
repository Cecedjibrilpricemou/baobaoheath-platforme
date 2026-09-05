import { Response } from 'express';
import { Request as ExpressRequest } from 'express';
import * as consultationService from '../services/consultation.service';
import { AuthRequest } from '../middlewares/auth.middleware';
import { EncounterStatus } from '@baobaoheath/shared-types';
import type { ConsultationDetailView } from '@baobaoheath/shared-types';

type RequestWithId = ExpressRequest<{ id: string }> & AuthRequest;

export async function createConsultationController(req: AuthRequest, res: Response): Promise<void> {
    const consultation = await consultationService.createConsultation(req.user!, req.body);
    res.status(201).json({ success: true, data: consultation });
}

export async function getConsultationByIdController(req: RequestWithId, res: Response): Promise<void> {
    // Annotation = contrat : un champ renomme ou une relation retiree de la
    // requete Prisma casse ici, au lieu de vider un bloc de la fiche.
    const consultation: ConsultationDetailView =
        await consultationService.getConsultationById(req.user!, req.params.id);
    res.status(200).json({ success: true, data: consultation });
}

export async function getConsultationsController(req: AuthRequest, res: Response): Promise<void> {
    const filters = {
        idPatient: req.query.idPatient as string | undefined,
        idAsc: req.query.idAsc as string | undefined,
        statut: typeof req.query.statut === 'string' ? req.query.statut as EncounterStatus : undefined,
        page: req.query.page ? parseInt(req.query.page as string) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    };
    const result = await consultationService.getConsultations(req.user!, filters);
    res.status(200).json({ success: true, ...result });
}

export async function updateConsultationController(req: RequestWithId, res: Response): Promise<void> {
    const consultation = await consultationService.updateConsultation(req.user!, req.params.id, req.body);
    res.status(200).json({ success: true, data: consultation });
}

export async function saveVitalsController(req: RequestWithId, res: Response): Promise<void> {
    const vitals = await consultationService.saveVitals(req.user!, req.params.id, req.body);
    res.status(200).json({ success: true, data: vitals });
}

export async function completeConsultationController(req: RequestWithId, res: Response): Promise<void> {
    const consultation = await consultationService.completeConsultation(req.user!, req.params.id);
    res.status(200).json({ success: true, data: consultation });
}

export async function addDiagnosticController(req: RequestWithId, res: Response): Promise<void> {
    const diagnostic = await consultationService.addDiagnostic(req.user!, req.params.id, req.body);
    res.status(201).json({ success: true, data: diagnostic });
}

export async function getDiagnosticsController(req: RequestWithId, res: Response): Promise<void> {
    const diagnostics = await consultationService.getDiagnostics(req.user!, req.params.id);
    res.status(200).json({ success: true, data: diagnostics });
}

export async function addOrdonnanceController(req: RequestWithId, res: Response): Promise<void> {
    const ordonnance = await consultationService.addOrdonnance(req.user!, req.params.id, req.body);
    res.status(201).json({ success: true, data: ordonnance });
}

export async function createReferralController(req: RequestWithId, res: Response): Promise<void> {
    const referral = await consultationService.createReferral(req.user!, req.params.id, req.body);
    res.status(201).json({ success: true, data: referral });
}

export async function getMesConsultationsController(req: AuthRequest, res: Response): Promise<void> {
    const filters = {
        statut: typeof req.query.statut === 'string' ? req.query.statut as EncounterStatus : undefined,
        page: req.query.page ? parseInt(req.query.page as string) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    };
    const result = await consultationService.getMesConsultations(req.user!.userId, filters);
    res.status(200).json({ success: true, ...result });
}
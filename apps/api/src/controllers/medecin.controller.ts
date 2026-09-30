import { Response } from 'express';
import { Request as ExpressRequest } from 'express';
import * as medecinService from '../services/medecin.service';
import * as laboratoire from '../services/laboratoire.service';
import { AuthRequest } from '../middlewares/auth.middleware';
import { ReferralStatus } from '@baobaoheath/shared-types';
import type {
  DemandeAnalyseView,
  OrientationMedecinView,
  RendezVousMedecinView,
  ResultatALibererView,
  ConsultationAValiderView,
  MedecinDashboardView,
  MessageView,
  ReferencementATraiterView,
} from '@baobaoheath/shared-types';

type RequestWithId = ExpressRequest<{ id: string }>;

// ─── Dashboard statistiques ───────────────────────────────
export async function getDashboardStatsController(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const stats: MedecinDashboardView = await medecinService.getDashboardStats(req.user!.userId);
    res.status(200).json({ success: true, data: stats });
}

// ─── Consultations à valider ──────────────────────────────
export async function getConsultationsAValiderController(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const filters = {
      prefecture: req.query.prefecture as string | undefined,
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    };
    const result = await medecinService.getConsultationsAValider(
      req.user!.userId,
      filters
    );
    const data: ConsultationAValiderView[] = result.data;
    res.status(200).json({ success: true, ...result, data });
}

// ─── Valider une consultation ─────────────────────────────
export async function validerConsultationController(
  req: AuthRequest & { params: { id: string } },
  res: Response
): Promise<void> {
  const consultation = await medecinService.validerConsultation(
      req.user!,
      req.params.id,
      req.body
    );
    res.status(200).json({ success: true, data: consultation });
}

// ─── Référencements à traiter ─────────────────────────────
export async function getOrientationsController(req: AuthRequest, res: Response): Promise<void> {
    const data: OrientationMedecinView[] = await medecinService.getOrientations(req.user!.userId);
    res.json({ success: true, data });
}

// Addendum du 2026-09-28 : le patient ne voit ses resultats qu'apres que le
// medecin les a liberes, avec l'explication qui va avec.
export async function getResultatsALibererController(req: AuthRequest, res: Response): Promise<void> {
    const data: ResultatALibererView[] = await laboratoire.mesResultatsALiberer(req.user!);
    res.json({ success: true, data });
}

export async function libererResultatsController(req: AuthRequest, res: Response): Promise<void> {
    const data: DemandeAnalyseView = await laboratoire.libererResultats(
        req.user!,
        req.params['id'] as string,
        req.body
    );
    res.json({ success: true, data, message: 'Resultats liberes : le patient peut les consulter' });
}

// Rendez-vous : le medecin fixe, consulte son agenda, et suit le patient
// jusqu'au bout de la consultation (addendum, points 3 et 8).
export async function fixerRendezVousController(req: AuthRequest, res: Response): Promise<void> {
    const data: RendezVousMedecinView = await medecinService.fixerRendezVous(
        req.user!.userId,
        req.params['idEpisode'] as string,
        req.body
    );
    res.status(201).json({ success: true, data, message: 'Rendez-vous fixe : le patient est prevenu' });
}

export async function getAgendaController(req: AuthRequest, res: Response): Promise<void> {
    const data: RendezVousMedecinView[] = await medecinService.getAgenda(req.user!.userId, {
        du: typeof req.query['du'] === 'string' ? req.query['du'] : undefined,
        au: typeof req.query['au'] === 'string' ? req.query['au'] : undefined,
    });
    res.json({ success: true, data });
}

export async function changerStatutRendezVousController(req: AuthRequest, res: Response): Promise<void> {
    const data: RendezVousMedecinView = await medecinService.changerStatutRendezVous(
        req.user!.userId,
        req.params['id'] as string,
        req.body.statut
    );
    res.json({ success: true, data });
}

export async function getReferencementsController(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const filters = {
      statut: typeof req.query.statut === 'string' ? req.query.statut as ReferralStatus : undefined,
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    };
    // Annotation = contrat : la page Referencements du medecin lit ces champs.
    const result: { data: ReferencementATraiterView[]; meta: unknown } = await medecinService.getReferencements(
      req.user!.userId,
      filters
    );
    res.status(200).json({ success: true, ...result });
}

// ─── Répondre à un référencement ──────────────────────────
export async function repondreReferencementController(
  req: AuthRequest & { params: { id: string } },
  res: Response
): Promise<void> {
  const referencement: ReferencementATraiterView = await medecinService.repondreReferencement(
      req.user!,
      req.params.id,
      req.body
    );
    res.status(200).json({ success: true, data: referencement });
}

// ─── Envoyer un message ───────────────────────────────────
export async function sendMessageController(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const message = await medecinService.sendMessage(
      req.user!.userId,
      req.body
    );
    res.status(201).json({ success: true, data: message });
}

// ─── Récupérer les messages ───────────────────────────────
export async function getMessagesController(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const messages: MessageView[] = await medecinService.getMessages(req.user!.userId);
    res.status(200).json({ success: true, data: messages });
}
import { Response } from 'express';
import { Request as ExpressRequest } from 'express';
import * as medecinService from '../services/medecin.service';
import { AuthRequest } from '../middlewares/auth.middleware';
import { ReferralStatus } from '@baobaoheath/shared-types';

type RequestWithId = ExpressRequest<{ id: string }>;

// ─── Profil du médecin connecté ───────────────────────────
export async function getMyMedecinProfileController(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const medecin = await medecinService.getMyMedecinProfile(req.user!.userId);
    res.status(200).json({ success: true, data: medecin });
}

// ─── Dashboard statistiques ───────────────────────────────
export async function getDashboardStatsController(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const stats = await medecinService.getDashboardStats(req.user!.userId);
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
    res.status(200).json({ success: true, ...result });
}

// ─── Valider une consultation ─────────────────────────────
export async function validerConsultationController(
  req: AuthRequest & { params: { id: string } },
  res: Response
): Promise<void> {
  const consultation = await medecinService.validerConsultation(
      req.user!.userId,
      req.params.id,
      req.body
    );
    res.status(200).json({ success: true, data: consultation });
}

// ─── Référencements à traiter ─────────────────────────────
export async function getReferencementsController(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const filters = {
      statut: typeof req.query.statut === 'string' ? req.query.statut as ReferralStatus : undefined,
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    };
    const result = await medecinService.getReferencements(
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
  const referencement = await medecinService.repondreReferencement(
      req.user!.userId,
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
  const messages = await medecinService.getMessages(req.user!.userId);
    res.status(200).json({ success: true, data: messages });
}
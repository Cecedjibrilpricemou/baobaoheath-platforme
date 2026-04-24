import { Response } from 'express';
import { Request as ExpressRequest } from 'express';
import * as medecinService from '../services/medecin.service';
import { AuthRequest } from '../middlewares/auth.middleware';

type RequestWithId = ExpressRequest<{ id: string }>;

// ─── Profil du médecin connecté ───────────────────────────
export async function getMyMedecinProfileController(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const medecin = await medecinService.getMyMedecinProfile(req.user!.userId);
    res.status(200).json({ success: true, data: medecin });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    res.status(404).json({ success: false, error: message });
  }
}

// ─── Dashboard statistiques ───────────────────────────────
export async function getDashboardStatsController(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const stats = await medecinService.getDashboardStats(req.user!.userId);
    res.status(200).json({ success: true, data: stats });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    res.status(500).json({ success: false, error: message });
  }
}

// ─── Consultations à valider ──────────────────────────────
export async function getConsultationsAValiderController(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    res.status(500).json({ success: false, error: message });
  }
}

// ─── Valider une consultation ─────────────────────────────
export async function validerConsultationController(
  req: AuthRequest & { params: { id: string } },
  res: Response
): Promise<void> {
  try {
    const consultation = await medecinService.validerConsultation(
      req.user!.userId,
      req.params.id,
      req.body
    );
    res.status(200).json({ success: true, data: consultation });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    res.status(400).json({ success: false, error: message });
  }
}

// ─── Référencements à traiter ─────────────────────────────
export async function getReferencementsController(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const filters = {
      statut: req.query.statut as string | undefined,
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    };
    const result = await medecinService.getReferencements(
      req.user!.userId,
      filters
    );
    res.status(200).json({ success: true, ...result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    res.status(500).json({ success: false, error: message });
  }
}

// ─── Répondre à un référencement ──────────────────────────
export async function repondreReferencementController(
  req: AuthRequest & { params: { id: string } },
  res: Response
): Promise<void> {
  try {
    const referencement = await medecinService.repondreReferencement(
      req.user!.userId,
      req.params.id,
      req.body
    );
    res.status(200).json({ success: true, data: referencement });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    res.status(400).json({ success: false, error: message });
  }
}

// ─── Envoyer un message ───────────────────────────────────
export async function sendMessageController(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const message = await medecinService.sendMessage(
      req.user!.userId,
      req.body
    );
    res.status(201).json({ success: true, data: message });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    res.status(400).json({ success: false, error: message });
  }
}

// ─── Récupérer les messages ───────────────────────────────
export async function getMessagesController(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const messages = await medecinService.getMessages(req.user!.userId);
    res.status(200).json({ success: true, data: messages });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    res.status(500).json({ success: false, error: message });
  }
}
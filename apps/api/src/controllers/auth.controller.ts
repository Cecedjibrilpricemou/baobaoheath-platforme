import { Request, Response } from 'express';
import * as authService from '../services/auth.service';
import { AuthRequest } from '../middlewares/auth.middleware';

export async function registerController(req: Request, res: Response): Promise<void> {
  try {
    const tokenPair = await authService.register(req.body);
    res.status(201).json({ success: true, data: tokenPair });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    res.status(400).json({ success: false, error: message });
  }
}

export async function loginController(req: Request, res: Response): Promise<void> {
  try {
    const tokenPair = await authService.login(req.body);
    res.status(200).json({ success: true, data: tokenPair });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    res.status(401).json({ success: false, error: message });
  }
}

export async function logoutController(req: AuthRequest, res: Response): Promise<void> {
  try {
    await authService.logout(req.user!.sessionId);
    res.status(200).json({ success: true, message: 'Déconnexion réussie' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    res.status(500).json({ success: false, error: message });
  }
}

export async function refreshController(req: Request, res: Response): Promise<void> {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(400).json({ success: false, error: 'Refresh token manquant' });
      return;
    }
    const tokenPair = await authService.refreshTokens(refreshToken);
    res.status(200).json({ success: true, data: tokenPair });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    res.status(401).json({ success: false, error: message });
  }
}

export async function getMeController(req: AuthRequest, res: Response): Promise<void> {
  try {
    const utilisateur = await authService.getMe(req.user!.userId);
    res.status(200).json({ success: true, data: utilisateur });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    res.status(404).json({ success: false, error: message });
  }
}

// ── NOUVEAU : Changer le mot de passe ────────────────────────────
export async function changerMotDePasseController(req: AuthRequest, res: Response): Promise<void> {
  try {
    await authService.changerMotDePasse(req.user!.userId, req.body);
    res.status(200).json({ success: true, message: 'Mot de passe mis à jour avec succès' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    res.status(400).json({ success: false, error: message });
  }
}

// ── NOUVEAU : Mettre à jour le profil ────────────────────────────
export async function updateProfilController(req: AuthRequest, res: Response): Promise<void> {
  try {
    await authService.updateProfil(req.user!.userId, req.body);
    const utilisateur = await authService.getMe(req.user!.userId);
    res.status(200).json({ success: true, data: utilisateur });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    res.status(400).json({ success: false, error: message });
  }
}

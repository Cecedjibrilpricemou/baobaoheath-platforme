import { Request, Response } from 'express';
import * as authService from '../services/auth.service';
import { AuthRequest } from '../middlewares/auth.middleware';
import { TokenPair } from '../types/auth.types';
import { setAuthCookies, clearAuthCookies, REFRESH_COOKIE } from '../utils/auth-cookies';

function sendTokens(res: Response, status: number, tokenPair: TokenPair) {
  setAuthCookies(res, tokenPair);
  res.status(status).json({ success: true, data: { authenticated: true } });
}

export async function registerController(req: Request, res: Response): Promise<void> {
  const tokenPair = await authService.register(req.body);
  sendTokens(res, 201, tokenPair);
}

export async function loginController(req: Request, res: Response): Promise<void> {
  const result = await authService.login(req.body);
  if ('accessToken' in result && 'refreshToken' in result) {
    sendTokens(res, 200, result);
  } else {
    res.status(200).json({ success: true, data: result });
  }
}

export async function verifyLoginOtpController(req: Request, res: Response): Promise<void> {
  const tokenPair = await authService.verifyLoginOtp(req.body);
  sendTokens(res, 200, tokenPair);
}

export async function logoutController(req: AuthRequest, res: Response): Promise<void> {
  await authService.logout(req.user!.sessionId);
  clearAuthCookies(res);
  res.status(200).json({ success: true, message: 'Déconnexion réussie' });
}

export async function refreshController(req: Request, res: Response): Promise<void> {
  const tokenFromCookie: string | undefined = req.cookies?.[REFRESH_COOKIE];
  const tokenFromBody: string | undefined = req.body?.refreshToken;
  const refreshToken = tokenFromCookie ?? tokenFromBody;

  if (!refreshToken) {
    res.status(400).json({ success: false, error: 'Refresh token manquant' });
    return;
  }

  const tokenPair = await authService.refreshTokens(refreshToken);
  sendTokens(res, 200, tokenPair);
}

export async function getMeController(req: AuthRequest, res: Response): Promise<void> {
  const utilisateur = await authService.getMe(req.user!.userId);
  res.status(200).json({ success: true, data: utilisateur });
}

export async function changerMotDePasseController(req: AuthRequest, res: Response): Promise<void> {
  await authService.changerMotDePasse(req.user!.userId, req.body);
  res.status(200).json({ success: true, message: 'Mot de passe mis à jour avec succès' });
}

export async function updateProfilController(req: AuthRequest, res: Response): Promise<void> {
  await authService.updateProfil(req.user!.userId, req.body);
  const utilisateur = await authService.getMe(req.user!.userId);
  res.status(200).json({ success: true, data: utilisateur });
}

export async function forgotPasswordController(req: Request, res: Response): Promise<void> {
  await authService.demanderResetMotDePasse(req.body);
  res.status(200).json({
    success: true,
    message: 'Si ce compte existe, un email de réinitialisation a été envoyé.',
  });
}

export async function resetPasswordController(req: Request, res: Response): Promise<void> {
  await authService.reinitialiserMotDePasse(req.body);
  res.status(200).json({ success: true, message: 'Mot de passe réinitialisé avec succès.' });
}

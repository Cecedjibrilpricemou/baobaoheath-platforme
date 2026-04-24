import { Response } from 'express';
import { Request as ExpressRequest } from 'express';
import * as vaccinationService from '../services/vaccination.service';
import { AuthRequest } from '../middlewares/auth.middleware';

type RequestWithId = ExpressRequest<{ id: string }>;

// ─── Administrer un vaccin ────────────────────────────────
export async function administrerVaccinController(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const vaccination = await vaccinationService.administrerVaccin(
      req.user!.userId,
      req.body
    );
    res.status(201).json({ success: true, data: vaccination });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    res.status(400).json({ success: false, error: message });
  }
}

// ─── Carnet vaccinal d'un patient (ASC/Médecin) ──────────
export async function getCarnetVaccinalController(
  req: AuthRequest & { params: { id: string } },
  res: Response
): Promise<void> {
  try {
    const filters = {
      vaccinNom: req.query.vaccinNom as string | undefined,
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    };
    const result = await vaccinationService.getCarnetVaccinal(
      req.params.id,
      filters
    );
    res.status(200).json({ success: true, ...result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    res.status(404).json({ success: false, error: message });
  }
}

// ─── Mon carnet vaccinal (patient connecté) ───────────────
export async function getMonCarnetVaccinalController(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const vaccinations = await vaccinationService.getMonCarnetVaccinal(
      req.user!.userId
    );
    res.status(200).json({ success: true, data: vaccinations });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    res.status(404).json({ success: false, error: message });
  }
}

// ─── Mettre à jour une vaccination ───────────────────────
export async function updateVaccinationController(
  req: AuthRequest & { params: { id: string } },
  res: Response
): Promise<void> {
  try {
    const vaccination = await vaccinationService.updateVaccination(
      req.params.id,
      req.body
    );
    res.status(200).json({ success: true, data: vaccination });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    res.status(400).json({ success: false, error: message });
  }
}

// ─── Rappels de vaccination à venir ──────────────────────
export async function getRappelsVaccinationController(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const filters = {
      joursAvant: req.query.joursAvant
        ? parseInt(req.query.joursAvant as string)
        : undefined,
      prefecture: req.query.prefecture as string | undefined,
    };
    const rappels = await vaccinationService.getRappelsVaccination(filters);
    res.status(200).json({ success: true, data: rappels });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    res.status(500).json({ success: false, error: message });
  }
}

// ─── Statistiques de vaccination ──────────────────────────
export async function getStatsVaccinationController(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const prefecture = req.query.prefecture as string | undefined;
    const stats = await vaccinationService.getStatsVaccination(prefecture);
    res.status(200).json({ success: true, data: stats });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    res.status(500).json({ success: false, error: message });
  }
}
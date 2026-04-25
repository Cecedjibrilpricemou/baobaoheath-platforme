import { Response } from 'express';
import * as analyticsService from '../services/analytics.service';
import { AuthRequest } from '../middlewares/auth.middleware';

// ─── Dashboard global ─────────────────────────────────────
export async function getDashboardGlobalController(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const filters = {
      prefecture: req.query.prefecture as string | undefined,
      debut: req.query.debut as string | undefined,
      fin: req.query.fin as string | undefined,
    };
    const data = await analyticsService.getDashboardGlobal(filters);
    res.status(200).json({ success: true, data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    res.status(500).json({ success: false, error: message });
  }
}

// ─── Données heatmap cartographique ──────────────────────
export async function getHeatmapController(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const filters = {
      pathologie: req.query.pathologie as string | undefined,
      debut: req.query.debut as string | undefined,
      fin: req.query.fin as string | undefined,
    };
    const data = await analyticsService.getHeatmapData(filters);
    res.status(200).json({ success: true, data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    res.status(500).json({ success: false, error: message });
  }
}

// ─── Alertes épidémiques ──────────────────────────────────
export async function getAlertesEpidemiquesController(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const data = await analyticsService.getAlertesEpidemiques();
    res.status(200).json({ success: true, data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    res.status(500).json({ success: false, error: message });
  }
}

// ─── Couverture vaccinale ─────────────────────────────────
export async function getCouvertureVaccinaleController(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const filters = {
      prefecture: req.query.prefecture as string | undefined,
    };
    const data = await analyticsService.getCouvertureVaccinale(filters);
    res.status(200).json({ success: true, data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    res.status(500).json({ success: false, error: message });
  }
}

// ─── Tendances temporelles ────────────────────────────────
export async function getTendancesController(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const filters = {
      prefecture: req.query.prefecture as string | undefined,
    };
    const data = await analyticsService.getTendances(filters);
    res.status(200).json({ success: true, data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    res.status(500).json({ success: false, error: message });
  }
}

// ─── Export données ───────────────────────────────────────
export async function exporterDonneesController(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const filters = {
      format: (req.query.format as 'JSON' | 'CSV') ?? 'JSON',
      debut: req.query.debut as string | undefined,
      fin: req.query.fin as string | undefined,
      prefecture: req.query.prefecture as string | undefined,
    };

    const data = await analyticsService.exporterDonnees(filters);

    if (filters.format === 'CSV') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename=baobaoheath-export.csv'
      );
      res.status(200).send(data.contenu);
      return;
    }

    res.status(200).json({ success: true, data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    res.status(500).json({ success: false, error: message });
  }
}
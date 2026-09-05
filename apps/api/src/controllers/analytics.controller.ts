import { Response } from 'express';
import type {
  AlerteEpidemiqueView,
  CouvertureVaccinaleView,
  DashboardAnalyticsView,
  HeatmapPointView,
  TendanceView,
} from '@baobaoheath/shared-types';
import * as analyticsService from '../services/analytics.service';
import { AuthRequest } from '../middlewares/auth.middleware';

// Les reponses sont annotees avec les vues partagees : c'est ici que se noue
// le contrat avec le front. Renommer un champ dans le service casse desormais
// la compilation de l'API, au lieu de vider un onglet sans aucun signal.

// ─── Dashboard global ─────────────────────────────────────
export async function getDashboardGlobalController(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const filters = {
      prefecture: req.query.prefecture as string | undefined,
      debut: req.query.debut as string | undefined,
      fin: req.query.fin as string | undefined,
    };
    const data: DashboardAnalyticsView = await analyticsService.getDashboardGlobal(filters);
    res.status(200).json({ success: true, data });
}

// ─── Données heatmap cartographique ──────────────────────
export async function getHeatmapController(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const filters = {
      pathologie: req.query.pathologie as string | undefined,
      debut: req.query.debut as string | undefined,
      fin: req.query.fin as string | undefined,
    };
    const data: HeatmapPointView[] = await analyticsService.getHeatmapData(filters);
    res.status(200).json({ success: true, data });
}

// ─── Alertes épidémiques ──────────────────────────────────
export async function getAlertesEpidemiquesController(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const alertes = await analyticsService.getAlertesEpidemiques();
    // dateDetection circule en ISO sur le fil : on l'expose explicitement
    // plutot que de laisser JSON.stringify convertir un Date en douce.
    const data: AlerteEpidemiqueView[] = alertes.map((alerte) => ({
      ...alerte,
      dateDetection: alerte.dateDetection.toISOString(),
    }));
    res.status(200).json({ success: true, data });
}

// ─── Couverture vaccinale ─────────────────────────────────
export async function getCouvertureVaccinaleController(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const filters = {
      prefecture: req.query.prefecture as string | undefined,
    };
    const data: CouvertureVaccinaleView = await analyticsService.getCouvertureVaccinale(filters);
    res.status(200).json({ success: true, data });
}

// ─── Tendances temporelles ────────────────────────────────
export async function getTendancesController(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const filters = {
      prefecture: req.query.prefecture as string | undefined,
    };
    const data: TendanceView[] = await analyticsService.getTendances(filters);
    res.status(200).json({ success: true, data });
}

// ─── Export données ───────────────────────────────────────
export async function exporterDonneesController(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const filters = {
      format: (req.query.format as 'JSON' | 'CSV' | 'DHIS2') ?? 'JSON',
      debut: req.query.debut as string | undefined,
      fin: req.query.fin as string | undefined,
      prefecture: req.query.prefecture as string | undefined,
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
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
}

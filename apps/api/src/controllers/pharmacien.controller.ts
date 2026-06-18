import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import * as pharmacienService from '../services/pharmacien.service';

export async function scanPatientController(req: AuthRequest, res: Response): Promise<void> {
  const data = await pharmacienService.scanPatient(String(req.params.qrCode), req.user!.userId);
    res.json({ success: true, data });
}

export async function delivrerOrdonnanceController(req: AuthRequest, res: Response): Promise<void> {
  const data = await pharmacienService.delivrerOrdonnance(String(req.params.id), req.user!.userId, req.body);
    res.json({ success: true, data });
}

export async function getStocksController(req: AuthRequest, res: Response): Promise<void> {
  const data = await pharmacienService.getStocksPharmacie(req.user!.userId);
    res.json({ success: true, data });
}

export async function getOrdonnancesController(req: AuthRequest, res: Response): Promise<void> {
  const data = await pharmacienService.getOrdonnances(req.user!.userId);
    res.json({ success: true, data });
}

export async function getAgentsController(req: AuthRequest, res: Response): Promise<void> {
  const data = await pharmacienService.getAgentsPharmacie(req.user!.userId);
    res.json({ success: true, data });
}

export async function creerAgentController(req: AuthRequest, res: Response): Promise<void> {
  const data = await pharmacienService.creerAgentPharmacie(req.user!.userId, req.body);
    res.status(201).json({ success: true, data });
}

export async function reapprovisionnerStockController(req: AuthRequest, res: Response): Promise<void> {
  const data = await pharmacienService.reapprovisionnerStock(req.user!.userId, req.body);
    res.json({ success: true, data, message: 'Stock mis a jour avec succes' });
}

export async function getMedicamentsController(_req: AuthRequest, res: Response): Promise<void> {
  const data = await pharmacienService.getMedicaments();
    res.json({ success: true, data });
}

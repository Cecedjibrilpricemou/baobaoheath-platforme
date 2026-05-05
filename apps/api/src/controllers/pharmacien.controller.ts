// src/controllers/pharmacien.controller.ts
import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import * as pharmacienService from '../services/pharmacien.service';

export async function scanPatientController(req: AuthRequest, res: Response): Promise<void> {
  try {
    const data = await pharmacienService.scanPatient(req.params.qrCode, req.user!.userId);
    res.json({ success: true, data });
  } catch (e: any) { res.status(404).json({ success: false, error: e.message }); }
}

export async function delivrerOrdonnanceController(req: AuthRequest, res: Response): Promise<void> {
  try {
    const data = await pharmacienService.delivrerOrdonnance(req.params.id, req.user!.userId, req.body);
    res.json({ success: true, data });
  } catch (e: any) { res.status(400).json({ success: false, error: e.message }); }
}

export async function getStocksController(req: AuthRequest, res: Response): Promise<void> {
  try {
    const data = await pharmacienService.getStocksPharmacie(req.user!.userId);
    res.json({ success: true, data });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
}

export async function getOrdonnancesController(req: AuthRequest, res: Response): Promise<void> {
  try {
    const data = await pharmacienService.getOrdonnances(req.user!.userId);
    res.json({ success: true, data });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
}

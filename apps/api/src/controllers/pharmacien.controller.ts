// src/controllers/pharmacien.controller.ts
import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import * as pharmacienService from '../services/pharmacien.service';

export async function scanPatientController(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { qrCode } = req.params;
    const data = await pharmacienService.scanPatient(qrCode);
    res.status(200).json({ success: true, data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    res.status(404).json({ success: false, error: message });
  }
}

export async function delivrerOrdonnanceController(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { modePaiement, quantiteDelivree } = req.body;

    if (!modePaiement) {
      res.status(400).json({ success: false, error: 'Mode de paiement obligatoire' });
      return;
    }

    const data = await pharmacienService.delivrerOrdonnance(
      id,
      req.user!.userId,
      modePaiement,
      quantiteDelivree
    );
    res.status(200).json({ success: true, data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    res.status(400).json({ success: false, error: message });
  }
}

export async function getStocksController(req: AuthRequest, res: Response): Promise<void> {
  try {
    const data = await pharmacienService.getStocksPharmacie(req.user!.userId);
    res.status(200).json({ success: true, data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    res.status(500).json({ success: false, error: message });
  }
}

export async function trouverPharmaciesProchesController(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { idMedicament } = req.params;
    const { latitude, longitude } = req.query;

    const data = await pharmacienService.trouverPharmaciesProches(
      idMedicament,
      parseFloat(latitude as string),
      parseFloat(longitude as string)
    );
    res.status(200).json({ success: true, data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    res.status(500).json({ success: false, error: message });
  }
}

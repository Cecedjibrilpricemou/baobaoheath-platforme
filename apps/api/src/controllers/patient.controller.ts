import { Request, Response } from 'express';
import * as patientService from '../services/patient.service';
import { AuthRequest } from '../middlewares/auth.middleware';

export async function createPatientController(req: Request, res: Response): Promise<void> {
  try {
    const result = await patientService.createPatient(req.body);
    res.status(201).json({ success: true, data: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    res.status(400).json({ success: false, error: message });
  }
}

export async function getPatientsController(req: Request, res: Response): Promise<void> {
  try {
    const filters = {
      prefecture: req.query.prefecture as string | undefined,
      search: req.query.search as string | undefined,
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    };
    const result = await patientService.getPatients(filters);
    res.status(200).json({ success: true, ...result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    res.status(500).json({ success: false, error: message });
  }
}

export async function getPatientByIdController(req: Request, res: Response): Promise<void> {
  try {
    const patient = await patientService.getPatientById(req.params.id);
    res.status(200).json({ success: true, data: patient });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    res.status(404).json({ success: false, error: message });
  }
}

export async function getPatientByQrCodeController(req: Request, res: Response): Promise<void> {
  try {
    const patient = await patientService.getPatientByQrCode(req.params.qrCode);
    res.status(200).json({ success: true, data: patient });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    res.status(404).json({ success: false, error: message });
  }
}

export async function getMyProfileController(req: AuthRequest, res: Response): Promise<void> {
  try {
    const patient = await patientService.getMyProfile(req.user!.userId);
    res.status(200).json({ success: true, data: patient });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    res.status(404).json({ success: false, error: message });
  }
}

export async function updateMyProfileController(req: AuthRequest, res: Response): Promise<void> {
  try {
    const updated = await patientService.updateMyProfile(req.user!.userId, req.body);
    res.status(200).json({ success: true, data: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    res.status(400).json({ success: false, error: message });
  }
}

export async function exportDossierController(req: AuthRequest, res: Response): Promise<void> {
  try {
    const dossier = await patientService.exportPatientDossier(req.user!.userId);
    res.status(200).json({ success: true, data: dossier });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    res.status(404).json({ success: false, error: message });
  }
}

// ── NOUVEAU : Choisir sa structure préférée ───────────────────────
export async function updateStructurePrefereeController(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { idStructure } = req.body;
    const updated = await patientService.updateStructurePreferee(req.user!.userId, idStructure ?? null);
    res.status(200).json({
      success: true,
      data: updated,
      message: idStructure ? 'Structure préférée mise à jour' : 'Structure préférée supprimée'
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    res.status(400).json({ success: false, error: message });
  }
}
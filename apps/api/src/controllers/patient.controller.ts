import { Request, Response } from 'express';
import * as patientService from '../services/patient.service';
import { AuthRequest } from '../middlewares/auth.middleware';
import { setAuthCookies } from '../utils/auth-cookies';

export async function createPatientController(req: Request, res: Response): Promise<void> {
  const { tokenPair, patient } = await patientService.createPatient(req.body);
  setAuthCookies(res, tokenPair);
  res.status(201).json({ success: true, data: { patient } });
}

export async function getPatientsController(req: AuthRequest, res: Response): Promise<void> {
  const filters = {
      prefecture: req.query.prefecture as string | undefined,
      search: req.query.search as string | undefined,
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    };
    const result = await patientService.getPatients(req.user!, filters);
    res.status(200).json({ success: true, ...result });
}

export async function getPatientByIdController(req: AuthRequest, res: Response): Promise<void> {
  const patient = await patientService.getPatientById(req.user!, String(req.params.id));
    res.status(200).json({ success: true, data: patient });
}

export async function getPatientByQrCodeController(req: AuthRequest, res: Response): Promise<void> {
  const patient = await patientService.getPatientByQrCode(req.user!, String(req.params.qrCode));
    res.status(200).json({ success: true, data: patient });
}

export async function getMyProfileController(req: AuthRequest, res: Response): Promise<void> {
  const patient = await patientService.getMyProfile(req.user!.userId);
    res.status(200).json({ success: true, data: patient });
}

export async function updateMyProfileController(req: AuthRequest, res: Response): Promise<void> {
  const updated = await patientService.updateMyProfile(req.user!.userId, req.body);
    res.status(200).json({ success: true, data: updated });
}

export async function exportDossierController(req: AuthRequest, res: Response): Promise<void> {
  const dossier = await patientService.exportPatientDossier(req.user!.userId);
    res.status(200).json({ success: true, data: dossier });
}

// ── NOUVEAU : Choisir sa structure préférée ───────────────────────
export async function updateStructurePrefereeController(req: AuthRequest, res: Response): Promise<void> {
  const { idStructure } = req.body;
    const updated = await patientService.updateStructurePreferee(req.user!.userId, idStructure ?? null);
    res.status(200).json({
      success: true,
      data: updated,
      message: idStructure ? 'Structure préférée mise à jour' : 'Structure préférée supprimée'
    });
}

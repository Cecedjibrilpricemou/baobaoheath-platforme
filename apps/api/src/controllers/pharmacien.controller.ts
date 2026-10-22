import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import * as pharmacienService from '../services/pharmacien.service';
import * as mouvementStockService from '../services/mouvement-stock.service';
import type {
  AjustementLotStockView,
  MedicamentTarifeView,
  MouvementStockView,
  ScanPatientView,
  StockPharmacieView,
  VerificationOrdonnanceView,
} from '@baobaoheath/shared-types';

export async function scanPatientController(req: AuthRequest, res: Response): Promise<void> {
  const data: ScanPatientView = await pharmacienService.scanPatient(String(req.params.qrCode), req.user!.userId);
    res.json({ success: true, data });
}

// `:id` designe une ligne d'ordonnance : la delivrance se fait medicament par
// medicament (EF-07-07), pas sur l'ordonnance entiere.
export async function delivrerOrdonnanceController(req: AuthRequest, res: Response): Promise<void> {
  const data = await pharmacienService.delivrerLigneOrdonnance(String(req.params.id), req.user!.userId, req.body);
    res.json({ success: true, data });
}

/** Substituer un produit, avec son motif (EF-07-04). */
export async function substituerLigneController(req: AuthRequest, res: Response): Promise<void> {
  const data = await pharmacienService.substituerLigneOrdonnance(
    String(req.params.id), req.user!.userId, req.body,
  );
  res.json({ success: true, data });
}

/** Refuser une ligne, avec son motif (EF-07-05). */
export async function refuserLigneController(req: AuthRequest, res: Response): Promise<void> {
  const data = await pharmacienService.refuserLigneOrdonnance(
    String(req.params.id), req.user!.userId, req.body,
  );
  res.json({ success: true, data });
}

/** EF-07-01 : controle d'une ordonnance par son numero et son code. */
export async function verifierOrdonnanceController(req: AuthRequest, res: Response): Promise<void> {
  const data: VerificationOrdonnanceView = await pharmacienService.verifierOrdonnance(
    req.user!.userId,
    req.body
  );
    res.json({ success: true, data });
}

/** EF-05-09 : ouvrir le cycle suivant d'une ordonnance renouvelable. */
export async function renouvelerOrdonnanceController(req: AuthRequest, res: Response): Promise<void> {
  const data = await pharmacienService.renouvelerAuComptoir(req.user!.userId, String(req.params.id));
    res.json({ success: true, data });
}

export async function getStocksController(req: AuthRequest, res: Response): Promise<void> {
  const data: StockPharmacieView[] = await pharmacienService.getStocksPharmacie(req.user!.userId);
    res.json({ success: true, data });
}

export async function getMouvementsStockController(req: AuthRequest, res: Response): Promise<void> {
  const limite = Number(req.query['limite'] ?? 100);
  const data: MouvementStockView[] = await mouvementStockService.listerMouvementsStock(
    req.user!.userId,
    Number.isFinite(limite) ? limite : 100,
  );
  res.json({ success: true, data });
}

export async function ajusterLotStockController(req: AuthRequest, res: Response): Promise<void> {
  const data: AjustementLotStockView = await mouvementStockService.ajusterLotStock(
    req.user!,
    String(req.params['idLot']),
    req.body.quantiteComptee,
    req.body.motif,
  );
  res.json({ success: true, data, message: 'Inventaire du lot enregistre' });
}

export async function getOrdonnancesController(req: AuthRequest, res: Response): Promise<void> {
  const data = await pharmacienService.getOrdonnances(req.user!.userId);
    res.json({ success: true, data });
}

export async function getAgentsController(req: AuthRequest, res: Response): Promise<void> {
  const data = await pharmacienService.getAgentsPharmacie(req.user!.userId);
    res.json({ success: true, data });
}

export async function getJournalConnexionsController(req: AuthRequest, res: Response): Promise<void> {
  const page = Number(req.query['page'] ?? 1);
  const limit = Number(req.query['limit'] ?? 25);
  const data = await pharmacienService.getJournalConnexions(
    req.user!.userId,
    Number.isFinite(page) ? page : 1,
    Number.isFinite(limit) ? limit : 25,
  );
  res.json({ success: true, data });
}

export async function mettreAJourEtatAgentController(req: AuthRequest, res: Response): Promise<void> {
  const data = await pharmacienService.mettreAJourEtatAgent(
    req.user!.userId,
    String(req.params['id']),
    req.body.estActif,
  );
  res.json({ success: true, data });
}

export async function changerRoleAgentController(req: AuthRequest, res: Response): Promise<void> {
  const data = await pharmacienService.changerRoleAgent(
    req.user!.userId,
    String(req.params['id']),
    req.body.roleOfficine,
  );
  res.json({ success: true, data });
}

export async function definirPermissionTemporaireController(req: AuthRequest, res: Response): Promise<void> {
  const data = await pharmacienService.definirPermissionTemporaire(
    req.user!.userId,
    String(req.params['id']),
    req.body,
  );
  res.json({ success: true, data });
}

export async function revoquerPermissionTemporaireController(req: AuthRequest, res: Response): Promise<void> {
  const data = await pharmacienService.revoquerPermissionTemporaire(
    req.user!.userId,
    String(req.params['id']),
  );
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

export async function getMedicamentsController(req: AuthRequest, res: Response): Promise<void> {
  // Le type est annonce ici : c'est ce qui a manque jusqu'au 2026-09-30, ou le
  // front declarait recevoir des lignes de stock et lisait `m.medicament`,
  // obtenant `undefined` sans qu'aucune erreur n'apparaisse.
  const data: MedicamentTarifeView[] = await pharmacienService.getMedicaments(req.user!.userId);
  res.json({ success: true, data });
}

export async function creerProduitOfficineController(req: AuthRequest, res: Response): Promise<void> {
  const data = await pharmacienService.creerProduitOfficine(req.user!.userId, req.body);
  res.status(201).json({ success: true, data });
}

export async function modifierProduitOfficineController(req: AuthRequest, res: Response): Promise<void> {
  const data = await pharmacienService.modifierProduitOfficine(
    req.user!.userId,
    String(req.params['id']),
    req.body,
  );
  res.json({ success: true, data });
}

export async function desactiverProduitOfficineController(req: AuthRequest, res: Response): Promise<void> {
  await pharmacienService.desactiverProduitOfficine(req.user!.userId, String(req.params['id']));
  res.json({ success: true, message: 'Produit desactive' });
}

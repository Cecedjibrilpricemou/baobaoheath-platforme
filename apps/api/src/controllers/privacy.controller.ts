import { Response } from 'express';
import { ConsentScope } from '../config/generated/client/client';
import { AuthRequest } from '../middlewares/auth.middleware';
import * as privacyService from '../services/privacy.service';
import * as consentement from '../services/consentement.service';
import type { ConsentementView } from '@baobaoheath/shared-types';

/**
 * La langue dans laquelle le patient lit.
 *
 * **Elle decide du texte qui lui sera montre**, et donc de ce a quoi il
 * consent. On prend celle de son compte ; a defaut, le francais, et la reponse
 * dira que le texte n'etait pas dans sa langue.
 */
async function langueDuPatient(userId: string): Promise<string> {
  const u = await privacyService.langueDe(userId);
  return u ?? consentement.LANGUE_DE_REPLI;
}

export async function getMyConsentsController(req: AuthRequest, res: Response): Promise<void> {
  const patient = await privacyService.getPatientForUser(req.user!.userId);
  // Annotation = contrat : la page Consentements du patient lit ces champs.
  const data: ConsentementView[] = await consentement.mesConsentements(
    patient.id,
    await langueDuPatient(req.user!.userId)
  );
  res.status(200).json({ success: true, data });
}

export async function setConsentController(req: AuthRequest, res: Response): Promise<void> {
  const patient = await privacyService.getPatientForUser(req.user!.userId);
  const langue = await langueDuPatient(req.user!.userId);

  const r = await consentement.enregistrer(patient.id, req.user!.userId, {
    scope: req.body.scope as ConsentScope,
    accorde: req.body.actif,
    langue,
    source: req.body.source,
    commentaire: req.body.commentaire,
  });

  if ('refus' in r) {
    // **On ne peut pas consentir a rien.** Tant qu'aucun texte n'est publie
    // pour cette portee, enregistrer un accord ferait croire a un
    // consentement eclaire qui n'existe pas.
    res.status(409).json({
      success: false,
      error: "Aucun texte de consentement n'est publie pour cet usage. "
        + "Tant qu'il n'y en a pas, un accord ne peut pas etre enregistre : "
        + "on ne consent pas a un texte qui n'existe pas.",
      motif: r.refus,
    });
    return;
  }

  const data: ConsentementView = r.consentement;
  res.status(200).json({ success: true, data });
}

/** L'histoire des consentements du patient connecte (EF-02-07). */
export async function getMyConsentHistoryController(req: AuthRequest, res: Response): Promise<void> {
  const patient = await privacyService.getPatientForUser(req.user!.userId);
  const scope = req.query['scope'] as ConsentScope | undefined;
  const data = await consentement.historique(patient.id, scope);
  res.status(200).json({ success: true, data });
}

export async function getMyAuditLogsController(req: AuthRequest, res: Response): Promise<void> {
  const result = await privacyService.getMyAuditLogs(req.user!.userId, {
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      // `?parTiers=true` ne garde que les acces d'autrui : c'est ce qu'on
      // cherche quand on soupconne une anomalie. Par defaut le journal est
      // complet, y compris les acces du patient lui-meme.
      parTiers: req.query.parTiers === 'true',
    });
    res.status(200).json({ success: true, ...result });
}

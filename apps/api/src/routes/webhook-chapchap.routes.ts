import express, { Request, Response, Router } from 'express';
import { logger } from '../config/logger';
import * as chapchap from '../services/chapchap.service';
import { appliquerStatutPasserelle } from '../services/paiement.service';

/**
 * Le rappel de Chap Chap Pay (EF-08).
 *
 * **Monte avant `express.json()`, et c'est indispensable.** La signature est
 * calculee sur les octets exacts du corps HTTP ; l'analyseur global remplace
 * ces octets par un objet, et re-serialiser produirait une autre chaine — un
 * espace, un ordre de cles — dont la signature ne correspondrait plus. Cette
 * route lit donc le corps brut, et ne le decode qu'une fois la signature
 * verifiee.
 *
 * **Aucune authentification de plateforme ici.** ChapChap ne porte ni jeton ni
 * cookie : c'est la signature qui fait foi, et elle seule.
 *
 * **Toute reponse HTTP met fin aux reprises de ChapChap**, y compris un 500 —
 * seule une absence de reponse est retentee. Un rappel perdu n'est donc pas
 * rattrape tout seul : c'est la relecture du statut
 * (`verifierStatutPaiement`) qui ferme le trou, et le tableau de bord de
 * ChapChap permet de renvoyer la notification a la main.
 */
const router = Router();

router.post(
  '/chapchap',
  express.raw({ type: ['application/json', 'text/plain'], limit: '256kb' }),
  async (req: Request, res: Response) => {
    const signature = req.header('CCP-HMAC-Signature') ?? '';
    const brut: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(String(req.body ?? ''));

    if (!chapchap.verifierSignature(brut, signature)) {
      // 401 et non 200 : ce n'est pas ChapChap, et rien ne doit etre rejoue.
      logger.warn('[CHAPCHAP] rappel refuse : signature invalide', {
        taille: brut.length, avecSignature: signature.length > 0,
      });
      res.status(401).json({ success: false, error: 'Signature invalide' });
      return;
    }

    let charge: {
      order_id?: string;
      operation_id?: string;
      amount?: number;
      status?: { code?: string };
      transaction?: { payment_reference?: string; payment_method?: string } | null;
    };
    try {
      charge = JSON.parse(brut.toString('utf8'));
    } catch {
      logger.warn('[CHAPCHAP] rappel signe mais illisible');
      res.status(400).json({ success: false, error: 'Corps illisible' });
      return;
    }

    const idFacture = charge.order_id;
    const statut = charge.status?.code;
    logger.info('[CHAPCHAP] rappel recu', {
      idFacture, operationId: charge.operation_id, statut,
    });

    if (!idFacture || !statut) {
      // Signe, donc authentique, mais inexploitable : rien a rejouer.
      res.status(200).json({ success: true, message: 'Rappel sans facture ni statut' });
      return;
    }

    try {
      const issue = await appliquerStatutPasserelle(idFacture, statut, {
        referenceTransaction: charge.transaction?.payment_reference ?? null,
        moyenPaiement: charge.transaction?.payment_method ?? null,
      });
      // Un rappel rejoue sur une facture deja payee est le cas normal, pas une
      // erreur : plusieurs notifications peuvent porter la meme operation.
      res.status(200).json({
        success: true,
        message: issue.dejaPayee ? 'Facture deja payee' : 'Statut applique',
      });
    } catch (e) {
      // Une facture inconnue n'est pas une panne : un rappel peut viser une
      // operation creee hors de cette base (un autre environnement partageant
      // le meme compte marchand). On l'acquitte pour ne pas le faire rejouer.
      const message = (e as Error).message;
      if (/non trouvee/i.test(message)) {
        logger.warn('[CHAPCHAP] rappel pour une facture inconnue', { idFacture });
        res.status(200).json({ success: true, message: 'Facture inconnue, rappel acquitte' });
        return;
      }
      logger.error('[CHAPCHAP] rappel non traite', { idFacture, statut, erreur: message });
      res.status(500).json({ success: false, error: 'Traitement impossible' });
    }
  }
);

export default router;

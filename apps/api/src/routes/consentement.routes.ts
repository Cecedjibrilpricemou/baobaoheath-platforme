import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';
import { validateBody, validateQuery } from '../middlewares/validate.middleware';
import * as consentement from '../services/consentement.service';
import {
  filtreTextesConsentementSchema, publierTexteConsentementSchema,
} from '../validators/api.schemas';
import type { ConsentScope } from '../config/generated/client/client';

/**
 * Les textes de consentement (EF-02-01).
 *
 * **Reserve a l'administration nationale.** Un texte de consentement vaut pour
 * toute la plateforme : c'est lui qui definit ce que les patients acceptent.
 * Le laisser modifier par chaque structure ferait dire au consentement des
 * choses differentes selon l'hopital.
 *
 * **On ne modifie jamais un texte publie.** Publier, c'est creer une version
 * de plus. Les accords deja donnes continuent de pointer vers la version
 * qu'ils ont vue — sans quoi on reecrirait apres coup ce a quoi les gens ont
 * dit oui.
 */
const router = Router();

router.use(authenticate);

/**
 * La liste des versions, brouillons et anciennes comprises.
 *
 * Lisible par tout compte authentifie : un soignant doit pouvoir lire le texte
 * sur lequel repose l'acces qu'on lui accorde.
 */
router.get(
  '/',
  validateQuery(filtreTextesConsentementSchema),
  async (req: AuthRequest, res: Response) => {
    const { scope } = req.query as { scope?: ConsentScope };
    const data = await consentement.versions(scope);
    res.json({ success: true, data });
  }
);

/** Le texte qu'un patient verrait aujourd'hui, dans la langue demandee. */
router.get('/en-vigueur', async (req: AuthRequest, res: Response) => {
  const scope = req.query['scope'] as ConsentScope | undefined;
  const langue = (req.query['langue'] as string | undefined) ?? consentement.LANGUE_DE_REPLI;
  if (!scope) {
    res.status(400).json({ success: false, error: 'Indiquez la portee (`scope`).' });
    return;
  }

  const trouve = await consentement.texteEnVigueur(scope, langue);
  if (!trouve) {
    // **Un 404 franc, pas un texte vide.** Tant qu'aucun texte n'est publie,
    // il n'y a rien a quoi consentir, et l'ecran doit le dire au lieu
    // d'afficher un cadre blanc.
    res.status(404).json({
      success: false,
      error: `Aucun texte publie pour ${scope}, ni en ${langue} ni en `
        + `${consentement.LANGUE_DE_REPLI}.`,
    });
    return;
  }

  res.json({ success: true, data: consentement.vueTexte(trouve.texte, trouve.langueDemandee) });
});

/**
 * Publier une nouvelle version.
 *
 * **Un texte plus recent ne revoque pas les accords deja donnes.** Revoquer
 * d'office couperait l'acces au dossier de soins de tous les patients le jour
 * ou l'on corrige une faute d'orthographe — et un acces coupe, en soins, ce
 * n'est pas un desagrement. Les patients concernes voient « le texte a change
 * depuis votre accord » et peuvent renouveler ; on demande, on n'impose pas.
 */
router.post(
  '/',
  requireRole('ADMIN_NATIONAL', 'SUPER_ADMIN'),
  validateBody(publierTexteConsentementSchema),
  async (req: AuthRequest, res: Response) => {
    const data = await consentement.publier(req.user!, req.body);
    res.status(201).json({
      success: true,
      data,
      message: `Version ${data.version} du texte « ${data.titre} » publiee en ${data.langue}. `
        + `Les accords deja donnes restent valables : les patients concernes verront `
        + `que le texte a change et pourront renouveler.`,
    });
  }
);

export default router;

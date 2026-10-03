import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import * as referentiel from '../services/referentiel.service';
import { importerReferentielSchema } from '../validators/api.schemas';
import { ValidationError } from '../utils/app-error';
import type {
  ColonnesReferentielView,
  RapportImportView,
  TypeReferentiel,
} from '@baobaoheath/shared-types';

/**
 * Import des referentiels (EF-12-03).
 *
 * Reserve a l'administration nationale : un referentiel vaut pour toute la
 * plateforme, et une regle d'interaction erronee se traduirait en alerte
 * fausse — ou absente — chez chaque prescripteur.
 */
const router = Router();

const TYPES: TypeReferentiel[] = ['examens', 'interactions', 'medicaments'];

function typeValide(brut: string): TypeReferentiel {
  if (!TYPES.includes(brut as TypeReferentiel)) {
    throw new ValidationError(`Referentiel « ${brut} » inconnu. Attendu : ${TYPES.join(', ')}`);
  }
  return brut as TypeReferentiel;
}

router.use(authenticate);
router.use(requireRole('ADMIN_NATIONAL', 'SUPER_ADMIN'));

/**
 * Les colonnes a preparer. Declaree avant `/:type/import` pour rester
 * lisible, et parce qu'un operateur la consulte avant d'importer.
 */
router.get('/:type/colonnes', async (req: AuthRequest, res: Response) => {
  const type = typeValide(req.params['type'] as string);
  const { obligatoires, facultatives } = referentiel.colonnesAttendues(type);
  const data: ColonnesReferentielView = { type, obligatoires, facultatives };
  res.json({ success: true, data });
});

/**
 * Importe un CSV.
 *
 * `simulation: true` valide tout et n'ecrit rien — c'est ce qu'on lance avant
 * un import reel. La reponse porte **une ligne par ligne du fichier**, avec
 * son verdict : un import qui echoue en silence sur trois lignes est pire que
 * pas d'import.
 */
router.post('/:type/import', validateBody(importerReferentielSchema), async (req: AuthRequest, res: Response) => {
  const type = typeValide(req.params['type'] as string);
  const data: RapportImportView = await referentiel.importerReferentiel(
    type,
    req.body.contenu,
    req.body.simulation === true
  );
  const resume = data.simulation
    ? `Simulation : ${data.creees} a creer, ${data.misesAJour} a mettre a jour, ${data.refusees} refusee(s)`
    : `${data.creees} creee(s), ${data.misesAJour} mise(s) a jour, ${data.refusees} refusee(s)`;
  res.json({ success: true, data, message: resume });
});

export default router;

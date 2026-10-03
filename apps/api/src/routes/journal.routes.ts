import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';
import * as journal from '../services/journal.service';
import * as anomalie from '../services/anomalie.service';
import { validateQuery } from '../middlewares/validate.middleware';
import { filtreJournalSchema } from '../validators/api.schemas';
import type { FiltreJournalDto, PageJournalView } from '@baobaoheath/shared-types';

/**
 * Recherche et export du journal d'audit (EF-12-05).
 *
 * Reserve a l'administration nationale : c'est le seul endroit de la
 * plateforme ou l'on voit, d'un coup, qui a touche au dossier de qui. Un
 * administrateur de structure n'a pas a voir les acces des autres structures,
 * et un soignant pas davantage.
 *
 * **Ces deux routes sont elles-memes journalisees** : `/journal` figure dans
 * `shouldAudit`. Sans cela, le seul endroit d'ou l'on voit tout serait le seul
 * qu'on ne verrait pas — et le journal ne prouverait plus rien le jour ou il
 * faudrait s'en servir.
 */
const router = Router();

router.use(authenticate);
router.use(requireRole('ADMIN_NATIONAL', 'SUPER_ADMIN'));

/**
 * La recherche. Sans `du`, elle ne remonte pas au-dela de 30 jours : une
 * requete sans critere ne doit pas balayer la table entiere.
 */
router.get('/', validateQuery(filtreJournalSchema), async (req: AuthRequest, res: Response) => {
  const data: PageJournalView = await journal.rechercher(req.query as FiltreJournalDto);
  res.json({ success: true, data });
});

/**
 * Les anomalies d'acces (EF-12-06).
 *
 * **Des signaux a examiner, pas des verdicts.** Un soignant de garde consulte
 * beaucoup de dossiers la nuit sans rien faire de mal, et un comptoir de
 * pharmacie scanne des dizaines de codes par jour. Chaque signal porte ce qui
 * l'a declenche et de quoi aller voir le detail dans le journal ; il ne
 * conclut rien.
 *
 * Declaree avant `/:type` — il n'y en a pas ici, mais la regle vaut : une
 * route litterale se declare avant une route a parametre.
 */
router.get('/anomalies', async (req: AuthRequest, res: Response) => {
  const heures = Number((req.query as Record<string, string>)['fenetreHeures']);
  const seuils = Number.isFinite(heures) && heures > 0 && heures <= 168
    ? { ...anomalie.SEUILS_PAR_DEFAUT, fenetreHeures: heures }
    : anomalie.SEUILS_PAR_DEFAUT;
  const data = await anomalie.detecter(seuils);
  res.json({ success: true, data });
});

/**
 * L'export CSV des memes criteres.
 *
 * Point-virgule et BOM, parce que c'est Excel en francais qui l'ouvrira. Un
 * export trop large est **refuse**, jamais tronque en silence : on conclurait
 * d'une absence de ligne qu'il ne s'est rien passe.
 */
router.get('/export', validateQuery(filtreJournalSchema), async (req: AuthRequest, res: Response) => {
  const contenu = await journal.exporterCsv(req.query as FiltreJournalDto);
  const jour = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="journal-audit-${jour}.csv"`);
  res.status(200).send(contenu);
});

export default router;

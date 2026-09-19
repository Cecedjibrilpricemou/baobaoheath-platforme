// src/routes/parametres.routes.ts
// Identite publique de la plateforme (nom, logo, coordonnees) : lue sans
// authentification par le web au demarrage (landing, auth, footer, onglet).
// L'edition reste sur /admin-structure/parametres (SUPER_ADMIN).
import { Router, Request, Response } from 'express';
import { getIdentitePlateforme } from '../services/parametres.service';
import type { IdentitePlateformeView } from '@baobaoheath/shared-types';

const router = Router();

router.get('/publics', async (_req: Request, res: Response) => {
  try {
    const data: IdentitePlateformeView = await getIdentitePlateforme();
    // Le navigateur peut garder la reponse une minute : elle change rarement
    // et elle est demandee a chaque chargement de page.
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.json({ success: true, data });
  } catch (e: unknown) {
    res.status(500).json({ success: false, error: e instanceof Error ? e.message : String(e) });
  }
});

export default router;

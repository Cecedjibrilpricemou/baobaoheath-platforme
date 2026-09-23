// src/routes/ordonnance.routes.ts
// Consultation et impression d'une ordonnance (EF-05-07/08, EF-06-02).
//
// Pas de restriction par role ici : l'habilitation se juge sur la consultation
// (assertCanAccessConsultation), qui sait deja qui peut voir quoi — le patient
// son dossier, l'ASC ses consultations, le medecin celles de sa structure.
// Filtrer en plus par role ferait diverger deux regles pour la meme question.
import { Router, Response } from 'express';

import { authenticate, AuthRequest } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';
import * as vue from '../services/ordonnance-vue.service';

const router = Router();

router.use(authenticate);

/** Les ordonnances du patient connecte. Declaree avant `/:id`. */
router.get('/me', requireRole('PATIENT'), async (req: AuthRequest, res: Response) => {
  const data = await vue.getOrdonnancesPatient(req.user!);
  res.json({ success: true, data });
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  const data = await vue.getOrdonnance(req.user!, req.params['id'] as string);
  res.json({ success: true, data });
});

/** Document imprimable (window.print cote client). */
router.get('/:id/document', async (req: AuthRequest, res: Response) => {
  const html = await vue.documentOrdonnance(req.user!, req.params['id'] as string);
  res.type('html').send(html);
});

export default router;

import { Router } from 'express';
import {
  getDashboardStatsController,
  getConsultationsAValiderController,
  validerConsultationController,
  getOrientationsController,
  fixerRendezVousController,
  getAgendaController,
  changerStatutRendezVousController,
  getResultatsALibererController,
  libererResultatsController,
  getReferencementsController,
  repondreReferencementController,
  sendMessageController,
  getMessagesController,
} from '../controllers/medecin.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import {
  validerConsultationSchema,
  fixerRendezVousSchema,
  libererResultatsSchema,
  statutRendezVousSchema,
  repondreReferencementSchema,
  sendMessageSchema,
} from '../validators/api.schemas';

const router = Router();

// ─── Tous les endpoints nécessitent auth + rôle MEDECIN ──
router.use(authenticate);
router.use(requireRole('MEDECIN', 'ADMIN_STRUCTURE', 'ADMIN_REGIONAL'));

// ─── Profil et dashboard ──────────────────────────────────
router.get('/dashboard', getDashboardStatsController);

// ─── Consultations ────────────────────────────────────────
router.get('/consultations', getConsultationsAValiderController);
router.put('/consultations/:id/valider', validateBody(validerConsultationSchema), validerConsultationController);

// ─── Rendez-vous ──────────────────────────────────────────
// Addendum du 2026-09-28 : c'est le médecin qui fixe le créneau, pas l'accueil.
router.post('/orientations/:idEpisode/rendez-vous', requireRole('MEDECIN'), validateBody(fixerRendezVousSchema), fixerRendezVousController);
router.get('/rendez-vous', requireRole('MEDECIN'), getAgendaController);
router.patch('/rendez-vous/:id/statut', requireRole('MEDECIN'), validateBody(statutRendezVousSchema), changerStatutRendezVousController);

// ─── Résultats d'analyse à libérer ────────────────────────
// Addendum du 2026-09-28 : le patient ne voit un résultat qu'après qu'un
// médecin l'a libéré, avec la possibilité d'y joindre une explication en
// langage clair. `requireRole('MEDECIN')` est explicite ici : le routeur laisse
// aussi passer les administrateurs, qui n'ont rien à libérer.
router.get('/resultats', requireRole('MEDECIN'), getResultatsALibererController);
router.post('/resultats/:id/liberer', requireRole('MEDECIN'), validateBody(libererResultatsSchema), libererResultatsController);

// ─── Référencements ───────────────────────────────────────
// EF-03-05 : les patients que l'accueil a orientes vers ce medecin.
router.get('/orientations', getOrientationsController);
router.get('/referencements', getReferencementsController);
router.put('/referencements/:id/repondre', validateBody(repondreReferencementSchema), repondreReferencementController);

// ─── Messagerie ───────────────────────────────────────────
router.get('/messages', getMessagesController);
router.post('/messages', validateBody(sendMessageSchema), sendMessageController);

export default router;
import { Router } from 'express';
import {
  registerController,
  loginController,
  logoutController,
  refreshController,
  getMeController,
  changerMotDePasseController,
  updateProfilController,
} from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.post('/register',        registerController);
router.post('/login',           loginController);
router.post('/refresh',         refreshController);
router.post('/logout',          authenticate, logoutController);
router.get('/me',               authenticate, getMeController);
router.put('/change-password',  authenticate, changerMotDePasseController); // ← NOUVEAU
router.put('/profile',          authenticate, updateProfilController);       // ← NOUVEAU

export default router;

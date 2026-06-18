import { Router } from 'express';
import {
  registerController,
  loginController,
  verifyLoginOtpController,
  logoutController,
  refreshController,
  getMeController,
  changerMotDePasseController,
  updateProfilController,
  forgotPasswordController,
  resetPasswordController,
} from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
  verifyLoginOtpSchema,
} from '../validators/api.schemas';

const router = Router();

router.post('/register', validateBody(registerSchema), registerController);
router.post('/login', validateBody(loginSchema), loginController);
router.post('/verify-otp', validateBody(verifyLoginOtpSchema), verifyLoginOtpController);
router.post('/refresh', validateBody(refreshSchema), refreshController);
router.post('/logout', authenticate, logoutController);
router.get('/me', authenticate, getMeController);
router.put('/change-password', authenticate, validateBody(changePasswordSchema), changerMotDePasseController);
router.put('/profile', authenticate, validateBody(updateProfileSchema), updateProfilController);
router.post('/forgot-password', validateBody(forgotPasswordSchema), forgotPasswordController);
router.post('/reset-password', validateBody(resetPasswordSchema), resetPasswordController);

export default router;

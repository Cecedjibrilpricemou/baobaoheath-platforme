import { Router } from 'express';
import {
  getMyAuditLogsController,
  getMyConsentsController,
  setConsentController,
} from '../controllers/privacy.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import { consentSchema } from '../validators/api.schemas';

const router = Router();

router.use(authenticate);
router.use(requireRole('PATIENT'));

router.get('/me/consents', getMyConsentsController);
router.put('/me/consents', validateBody(consentSchema), setConsentController);
router.get('/me/audit-logs', getMyAuditLogsController);

export default router;

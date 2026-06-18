import { Router } from 'express';
import { getChangesController, pushMutationsController } from '../controllers/sync.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';
import { validateBody, validateQuery } from '../middlewares/validate.middleware';
import { syncChangesQuerySchema, syncPushSchema } from '../validators/api.schemas';

const router = Router();

router.use(authenticate);
router.use(requireRole('PATIENT', 'ASC', 'ASC_SUPERVISOR', 'MEDECIN', 'PHARMACIEN', 'ADMIN_STRUCTURE'));

router.get('/changes', validateQuery(syncChangesQuerySchema), getChangesController);
router.post('/push', validateBody(syncPushSchema), pushMutationsController);
router.post('/mutations', validateBody(syncPushSchema), pushMutationsController);

export default router;

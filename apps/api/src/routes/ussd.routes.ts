import { Router } from 'express';
import { ussdSessionController } from '../controllers/ussd.controller';
import { validateBody } from '../middlewares/validate.middleware';
import { ussdSessionSchema } from '../validators/api.schemas';

const router = Router();

router.post('/session', validateBody(ussdSessionSchema), ussdSessionController);

export default router;

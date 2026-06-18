import { Router } from 'express';
import { publicStatsController } from '../controllers/stats.controller';

const router = Router();

// Public — no authentication required
router.get('/public', publicStatsController);

export default router;

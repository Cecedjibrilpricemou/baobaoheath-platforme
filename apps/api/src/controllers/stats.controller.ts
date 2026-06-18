import { Request, Response, NextFunction } from 'express';
import { getPublicStats } from '../services/stats.service';

export async function publicStatsController(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const data = await getPublicStats();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';
import { requestContext } from '../utils/request-context';

const REQUEST_ID_HEADER = 'x-request-id';

export function requestContextMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incomingId = req.headers[REQUEST_ID_HEADER];
  const requestId = (typeof incomingId === 'string' && incomingId.trim()) || randomUUID();
  res.setHeader('X-Request-Id', requestId);

  requestContext.run({ requestId }, () => {
    const start = Date.now();
    logger.http(`--> ${req.method} ${req.originalUrl}`);

    res.on('finish', () => {
      logger.http(`<-- ${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`, {
        statusCode: res.statusCode,
        durationMs: Date.now() - start,
      });
    });

    next();
  });
}

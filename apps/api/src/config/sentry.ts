import * as Sentry from '@sentry/node';
import { logger } from './logger';

export function initSentry(dsn: string | undefined): void {
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
  });

  logger.info('Sentry error tracking initialise');
}

export function captureError(err: unknown, context?: Record<string, unknown>): void {
  if (Sentry.isInitialized()) {
    Sentry.withScope((scope) => {
      if (context) scope.setExtras(context);
      Sentry.captureException(err);
    });
  }
}

export { Sentry };

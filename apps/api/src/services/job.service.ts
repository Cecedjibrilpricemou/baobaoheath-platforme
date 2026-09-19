import Redis from 'ioredis';
import { detecterEtPersisterAlertesEpidemiques } from './analytics.service';
import { verifierRappelsAEnvoyer } from './notification.service';
import { expirerSessionsUssd } from './ussd.service';
import { traiterAlertesCritiques } from './laboratoire.service';
import { logger } from '../config/logger';

let started = false;
let redis: Redis | undefined;

function isVerboseJobsEnabled(): boolean {
  return process.env.VERBOSE_JOBS === 'true';
}

async function withOptionalRedisLock<T>(key: string, fn: () => Promise<T>): Promise<T | undefined> {
  if (!redis) return fn();

  const lockKey = `baobaohealth:job-lock:${key}`;
  const acquired = await redis.set(lockKey, '1', 'EX', 60, 'NX');
  if (!acquired) return undefined;

  try {
    return await fn();
  } finally {
    await redis.del(lockKey);
  }
}

export function startBackgroundJobs() {
  if (started || process.env.ENABLE_JOBS === 'false') return;
  started = true;

  if (process.env.REDIS_URL) {
    redis = new Redis(process.env.REDIS_URL, { lazyConnect: true });
    redis.connect().catch((error: unknown) => {
      logger.warn('Redis indisponible, jobs en mode local', { error });
      redis = undefined;
    });
  }

  const runRappels = () => {
    void withOptionalRedisLock('rappels', async () => {
      const result = await verifierRappelsAEnvoyer();
      const hasWork = result.rendezVousARappeler > 0 || result.vaccinationsARappeler > 0;
      if (hasWork || isVerboseJobsEnabled()) {
        logger.info('[JOB] rappels verifies', result);
      }
    }).catch((error: unknown) => logger.error('[JOB] rappels failed', { error }));
  };

  const runAlertes = () => {
    void withOptionalRedisLock('alertes-epidemiques', async () => {
      const result = await detecterEtPersisterAlertesEpidemiques();
      if (result.total > 0 || isVerboseJobsEnabled()) {
        logger.info('[JOB] alertes epidemiques', { total: result.total });
      }
    }).catch((error: unknown) => logger.error('[JOB] alertes failed', { error }));
  };

  const runUssdCleanup = () => {
    void withOptionalRedisLock('ussd-cleanup', async () => {
      const result = await expirerSessionsUssd();
      if (result.count > 0 || isVerboseJobsEnabled()) {
        logger.info('[JOB] sessions ussd expirees', { count: result.count });
      }
    }).catch((error: unknown) => logger.error('[JOB] ussd cleanup failed', { error }));
  };

  // Resultats critiques (EF-04-08/09) : escalade sans accuse, diffusion differee.
  const runCritiques = () => {
    void withOptionalRedisLock('resultats-critiques', async () => {
      const result = await traiterAlertesCritiques();
      if (result.escaladees > 0 || result.diffusees > 0 || isVerboseJobsEnabled()) {
        logger.info('[JOB] resultats critiques', result);
      }
    }).catch((error: unknown) => logger.error('[JOB] resultats critiques failed', { error }));
  };

  runRappels();
  runAlertes();
  runUssdCleanup();
  runCritiques();
  setInterval(runCritiques, 5 * 60 * 1000);
  setInterval(runRappels, 60 * 60 * 1000);
  setInterval(runAlertes, 6 * 60 * 60 * 1000);
  setInterval(runUssdCleanup, 10 * 60 * 1000);
}

jest.mock('../src/services/analytics.service', () => ({
  detecterEtPersisterAlertesEpidemiques: jest.fn().mockResolvedValue({ total: 0 }),
}));
jest.mock('../src/services/notification.service', () => ({
  verifierRappelsAEnvoyer: jest.fn().mockResolvedValue({ rendezVousARappeler: 0, vaccinationsARappeler: 0 }),
}));
jest.mock('../src/services/ussd.service', () => ({
  expirerSessionsUssd: jest.fn().mockResolvedValue({ count: 0 }),
}));
jest.mock('../src/services/laboratoire.service', () => ({
  traiterAlertesCritiques: jest.fn().mockResolvedValue({ escaladees: 0, relancees: 0, escaladesLiberation: 0 }),
}));
jest.mock('../src/config/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { startBackgroundJobs } from '../src/services/job.service';

describe('startBackgroundJobs', () => {
  it('unrefs all recurring timers so they do not keep Jest alive', () => {
    const timers = Array.from({ length: 4 }, () => ({
      unref: jest.fn(),
    } as unknown as NodeJS.Timeout));
    let nextTimer = 0;
    const setIntervalSpy = jest.spyOn(global, 'setInterval')
      .mockImplementation(() => timers[nextTimer++]!);

    const previousEnableJobs = process.env.ENABLE_JOBS;
    const previousRedisUrl = process.env.REDIS_URL;
    process.env.ENABLE_JOBS = 'true';
    delete process.env.REDIS_URL;

    try {
      startBackgroundJobs();

      expect(setIntervalSpy).toHaveBeenCalledTimes(4);
      for (const timer of timers) expect(timer.unref).toHaveBeenCalledTimes(1);
    } finally {
      if (previousEnableJobs === undefined) delete process.env.ENABLE_JOBS;
      else process.env.ENABLE_JOBS = previousEnableJobs;
      if (previousRedisUrl === undefined) delete process.env.REDIS_URL;
      else process.env.REDIS_URL = previousRedisUrl;
      setIntervalSpy.mockRestore();
    }
  });
});

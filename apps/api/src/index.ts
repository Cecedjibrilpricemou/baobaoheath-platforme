import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import path from 'path';
import { env } from './config/env';

import authRoutes from './routes/auth.routes';
import patientRoutes from './routes/patient.routes';
import consultationRoutes from './routes/consultation.routes';
import medicamentRoutes from './routes/medicament.routes';
import ascRoutes from './routes/asc.routes';
import medecinRoutes from './routes/medecin.routes';
import paiementRoutes from './routes/paiement.routes';
import vaccinationRoutes from './routes/vaccination.routes';
import notificationRoutes from './routes/notification.routes';
import analyticsRoutes from './routes/analytics.routes';
import adminStructureRoutes from './routes/admin-structure.routes';
import pharmacienRoutes from './routes/pharmacien.routes';
import syncRoutes from './routes/sync.routes';
import fhirRoutes from './routes/fhir.routes';
import triageRoutes from './routes/triage.routes';
import privacyRoutes from './routes/privacy.routes';
import ussdRoutes from './routes/ussd.routes';
import statsRoutes from './routes/stats.routes';
import uploadRoutes from './routes/upload.routes';
import { setupSwagger } from './config/swagger';
import { logger } from './config/logger';
import { prisma } from './config/prisma';
import { initSentry, captureError } from './config/sentry';
import { initRedis, getRedis } from './config/redis';
import { auditRequest } from './services/audit.service';
import { startBackgroundJobs } from './services/job.service';
import { globalErrorHandler } from './middlewares/error.middleware';
import { requestContextMiddleware } from './middlewares/request-context.middleware';
import { createServer } from 'http';
import { initSocketServer } from './realtime/socket.server';

initSentry(env.SENTRY_DSN);

process.on('uncaughtException', (err) => {
  captureError(err, { type: 'uncaughtException' });
  logger.error('uncaughtException — shutting down', { error: err.message, stack: err.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  captureError(reason, { type: 'unhandledRejection' });
  logger.error('unhandledRejection — shutting down', { reason });
  process.exit(1);
});

const app = express();

// Shared Redis client (rate limiting + cache)
if (env.REDIS_URL) {
  initRedis(env.REDIS_URL);
}
const redisClient = getRedis();

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  ...(redisClient && {
    store: new RedisStore({
      prefix: 'rl:api:',
      sendCommand: async (...args: string[]) => redisClient!.call(args[0], ...args.slice(1)) as any,
    }),
  }),
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  ...(redisClient && {
    store: new RedisStore({
      prefix: 'rl:auth:',
      sendCommand: async (...args: string[]) => redisClient!.call(args[0], ...args.slice(1)) as any,
    }),
  }),
});

app.use(helmet());

const corsOptions = {
  origin: env.ALLOWED_ORIGINS,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
};
app.use(cors(corsOptions));
app.use(requestContextMiddleware);
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Fichiers uploadés (photos de profil) — servis sur une origine différente du
// front (localhost:4200 vs localhost:3000), donc CORP explicite requis sinon
// helmet() bloque le chargement de l'image côté navigateur.
app.use('/uploads', (_req: Request, res: Response, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(path.join(process.cwd(), 'uploads')));

app.use('/api/v1', apiLimiter);

app.get('/health', async (_req: Request, res: Response) => {
  const checks: Record<string, 'ok' | 'error'> = {};

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.postgres = 'ok';
  } catch {
    checks.postgres = 'error';
  }

  if (redisClient) {
    try {
      await redisClient.ping();
      checks.redis = 'ok';
    } catch {
      checks.redis = 'error';
    }
  }

  const allOk = Object.values(checks).every((s) => s === 'ok');
  res.status(allOk ? 200 : 503).json({
    success: allOk,
    message: allOk ? 'BaoBaoHealth API operationnelle' : 'Degraded',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    checks,
  });
});

setupSwagger(app);

app.use('/api/v1', auditRequest);

// Le quota anti-force brute ne vise que les routes qui verifient un secret.
// Applique a tout /auth, il etait consomme par /refresh et /me — appelees a
// chaque chargement de page — et bloquait la connexion apres une dizaine de
// navigations. Les routes de session restent couvertes par apiLimiter.
const ROUTES_SENSIBLES = [
  '/api/v1/auth/login',
  '/api/v1/auth/register',
  '/api/v1/auth/verify-otp',
  '/api/v1/auth/forgot-password',
  '/api/v1/auth/reset-password',
  '/api/v1/auth/change-password',
];
for (const route of ROUTES_SENSIBLES) {
  app.use(route, authLimiter);
}

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/patients', patientRoutes);
app.use('/api/v1/consultations', consultationRoutes);
app.use('/api/v1/medicaments', medicamentRoutes);
app.use('/api/v1/asc', ascRoutes);
app.use('/api/v1/medecin', medecinRoutes);
app.use('/api/v1/paiements', paiementRoutes);
app.use('/api/v1/vaccinations', vaccinationRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/admin-structure', adminStructureRoutes);
app.use('/api/v1/pharmacien', pharmacienRoutes);
app.use('/api/v1/sync', syncRoutes);
app.use('/api/v1/fhir', fhirRoutes);
app.use('/api/v1/triage', triageRoutes);
app.use('/api/v1/privacy', privacyRoutes);
app.use('/api/v1/ussd', ussdRoutes);
app.use('/api/v1/stats', statsRoutes);
app.use('/api/v1/uploads', uploadRoutes);

// Route 404
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, error: 'Route non trouvee' });
});

// Middleware global de gestion des erreurs
app.use(globalErrorHandler);

const httpServer = createServer(app);
initSocketServer(httpServer);

httpServer.listen(env.PORT, () => {
  logger.info(`Documentation API : http://localhost:${env.PORT}/api/docs`);
  logger.info(`BaoBaoHealth API : http://localhost:${env.PORT}`);
  logger.info(`Environnement   : ${env.NODE_ENV}`);
  logger.info(`CORS origins    : ${env.ALLOWED_ORIGINS.join(', ')}`);
  logger.info(`WebSocket       : ws://localhost:${env.PORT}`);
  startBackgroundJobs();
});

export default app;

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import 'dotenv/config';

// ─── Import des routes ────────────────────────────────────
import authRoutes from './routes/auth.routes';
import patientRoutes from './routes/patient.routes';
import consultationRoutes from './routes/consultation.routes';
import ascRoutes from './routes/asc.routes';
import medecinRoutes from './routes/medecin.routes';
import paiementRoutes from './routes/paiement.routes';

// ─── Import Swagger ───────────────────────────────────────
import { setupSwagger } from './config/swagger';

const app = express();
const PORT = process.env.PORT ?? 3000;

// ─── Middlewares globaux de sécurité ─────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') ?? ['http://localhost:4200'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));


// ─── Route de santé ───────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'BaoBaoHealth API operationnelle',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV ?? 'development',
  });
});

// ─── Documentation Swagger ────────────────────────────────
setupSwagger(app);

// ─── Routes API v1 ────────────────────────────────────────
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/patients', patientRoutes);
app.use('/api/v1/consultations', consultationRoutes);
app.use('/api/v1/asc', ascRoutes);
app.use('/api/v1/medecin', medecinRoutes);
app.use('/api/v1/paiements', paiementRoutes);

// ─── Route 404 ────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Route non trouvee',
  });
});

// ─── Gestionnaire d'erreurs global ───────────────────────
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production'
      ? 'Erreur interne'
      : err.message,
  });
});

// ─── Démarrage du serveur ─────────────────────────────────
app.listen(PORT, () => {
  console.log(`BaoBaoHealth API : http://localhost:${PORT}`);
  console.log(`Environnement   : ${process.env.NODE_ENV ?? 'development'}`);
});

export default app;
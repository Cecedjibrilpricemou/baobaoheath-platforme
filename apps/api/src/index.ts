import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import 'dotenv/config';

import authRoutes from './routes/auth.routes';
import patientRoutes from './routes/patient.routes';
import consultationRoutes from './routes/consultation.routes';
import ascRoutes from './routes/asc.routes';
import medecinRoutes from './routes/medecin.routes';
import pharmacienRoutes from './routes/pharmacien.routes';
import paiementRoutes from './routes/paiement.routes';
import vaccinationRoutes from './routes/vaccination.routes';
import notificationRoutes from './routes/notification.routes';
import analyticsRoutes from './routes/analytics.routes';
import adminStructureRoutes from './routes/admin-structure.routes';

import { setupSwagger } from './config/swagger';

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') ?? ['http://localhost:4200'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'BaoBaoHealth API operationnelle',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV ?? 'development',
  });
});

setupSwagger(app);

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/patients', patientRoutes);
app.use('/api/v1/consultations', consultationRoutes);
app.use('/api/v1/asc', ascRoutes);
app.use('/api/v1/medecin', medecinRoutes);
app.use('/api/v1/pharmacien', pharmacienRoutes);  // ← NOUVEAU
app.use('/api/v1/paiements', paiementRoutes);
app.use('/api/v1/vaccinations', vaccinationRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/admin-structure', adminStructureRoutes);

app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, error: 'Route non trouvee' });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Erreur interne' : err.message,
  });
});

app.listen(PORT, () => {
  console.log(`Documentation API : http://localhost:${PORT}/api/docs`);
  console.log(`BaoBaoHealth API : http://localhost:${PORT}`);
  console.log(`Environnement   : ${process.env.NODE_ENV ?? 'development'}`);
});

export default app;

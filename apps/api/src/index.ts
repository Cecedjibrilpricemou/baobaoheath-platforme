import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import 'dotenv/config';

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
  console.log(`BaoBaoHealth API : http://localhost:${PORT}`);
  console.log(`Environnement   : ${process.env.NODE_ENV ?? 'development'}`);
});

export default app;
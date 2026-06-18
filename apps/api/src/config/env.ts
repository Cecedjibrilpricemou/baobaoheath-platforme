import 'dotenv/config';
import { z } from 'zod';

/**
 * Validation des variables d'environnement au démarrage.
 *
 * L'application plante immédiatement (fail fast) si une variable
 * requise est manquante ou invalide, au lieu de crasher plus tard
 * de façon silencieuse.
 */
const envSchema = z.object({
  // ─── Base de données ─────────────────────────────────
  DATABASE_URL: z.string().min(1, 'DATABASE_URL est obligatoire'),

  // ─── JWT ─────────────────────────────────────────────
  JWT_SECRET: z.string().min(16, 'JWT_SECRET doit contenir au moins 16 caracteres'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // ─── Serveur ─────────────────────────────────────────
  PORT: z
    .string()
    .default('3000')
    .transform((val) => parseInt(val, 10))
    .refine((val) => val > 0 && val < 65536, 'PORT doit etre entre 1 et 65535'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  ALLOWED_ORIGINS: z
    .string()
    .optional()
    .transform((val) => val?.split(',').map((s) => s.trim()) ?? ['http://localhost:4200']),

  // ─── Email (optionnel en dev) ────────────────────────
  GMAIL_USER: z.string().optional(),
  GMAIL_APP_PASSWORD: z.string().optional(),

  // ─── Redis (optionnel) ──────────────────────────────
  REDIS_URL: z.string().url().optional(),

  // ─── Jobs ───────────────────────────────────────────
  ENABLE_JOBS: z
    .string()
    .optional()
    .transform((val) => val !== 'false'),
  VERBOSE_JOBS: z
    .string()
    .optional()
    .transform((val) => val === 'true'),

  // ─── Frontend URL (pour les liens dans les emails) ──
  FRONTEND_URL: z.string().default('http://localhost:4200'),

  // ─── OTP dev fallback ───────────────────────────────
  EMAIL_OTP_DEV_FALLBACK: z
    .string()
    .optional()
    .transform((val) => val !== 'false'),
});

function validateEnv() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Variables d\'environnement invalides :');
    for (const issue of result.error.issues) {
      console.error(`   → ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }

  return result.data;
}

export const env = validateEnv();

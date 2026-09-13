// Tests end-to-end : vrai navigateur, vraie API, vraie base PostgreSQL.
//
//   E2E_DATABASE_URL=postgresql://... npm run e2e --workspace=apps/web
//
// Le setup global applique les migrations et le seed e2e sur cette base,
// puis Playwright demarre l'API (port 3000) et le front (port 4200). En CI
// (.github/workflows/ci.yml, job e2e) la base est un service Postgres.
import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';

const API_PORT = 3000;
const WEB_PORT = 4200;
const RACINE = resolve(__dirname, '../..');

export const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? 'postgresql://baobaoheath:baobaoheath@localhost:55433/baobaoheath_e2e';

// Meme jeu de variables que le job "API — Build & Test" de la CI. Le fichier
// DOTENV_CONFIG_PATH n'existe pas : l'API n'ira pas lire le .env local, qui
// pointe sur la base de developpement.
export const API_ENV: Record<string, string> = {
  NODE_ENV: 'development',
  PORT: String(API_PORT),
  DATABASE_URL: E2E_DATABASE_URL,
  DOTENV_CONFIG_PATH: resolve(__dirname, 'e2e/.env.absent'),
  JWT_SECRET: 'e2e-test-secret-at-least-32-chars-long',
  JWT_REFRESH_SECRET: 'e2e-test-refresh-secret-at-least-32-chars',
  DB_ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  ALLOWED_ORIGINS: `http://localhost:${WEB_PORT}`,
  FRONTEND_URL: `http://localhost:${WEB_PORT}`,
  // Pas de Gmail : l'OTP tombe en repli developpement et arrive dans la
  // reponse de /auth/login, que le front affiche (.otp-dev-code).
  EMAIL_OTP_DEV_FALLBACK: 'true',
};

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  // Les trois parcours partagent la meme base et s'enchainent (ASC cree ce
  // que le medecin et le pharmacien traitent) : un seul worker, dans l'ordre.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    locale: 'fr-FR',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      // En local, le Chrome installe suffit (pas de telechargement de
      // navigateur) ; en CI, le Chromium de Playwright est installe.
      use: { ...devices['Desktop Chrome'], channel: process.env.CI ? undefined : 'chrome' },
    },
  ],
  webServer: [
    {
      // Sans --watch : rien ne doit relancer l'API au milieu d'un parcours.
      command: 'npx tsx src/index.ts',
      cwd: resolve(RACINE, 'apps/api'),
      url: `http://localhost:${API_PORT}/health`,
      env: API_ENV,
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      // --prebundle=false : le pre-bundling Vite verrouille des fichiers sous
      // Windows (EPERM rename) et laisse une page blanche.
      command: `npx ng serve --port ${WEB_PORT} --host localhost --prebundle=false`,
      cwd: __dirname,
      url: `http://localhost:${WEB_PORT}`,
      timeout: 240_000,
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
});

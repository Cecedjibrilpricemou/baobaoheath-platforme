import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';

const API_PORT = 3137;
const WEB_PORT = 4327;
const RACINE = resolve(__dirname, '../..');
const DATABASE_URL = process.env['E2E_DATABASE_URL'];

if (!DATABASE_URL) throw new Error('E2E_DATABASE_URL is required for acceptance tests');

process.env['E2E_API_URL'] = `http://localhost:${API_PORT}/api/v1`;

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    locale: 'fr-FR',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{
    name: 'chromium',
    use: { ...devices['Desktop Chrome'], channel: 'chrome' },
  }],
  webServer: [
    {
      command: 'npx prisma migrate deploy --config prisma.config.ts && npx tsx prisma/seed-e2e.ts && npx tsx src/index.ts',
      cwd: resolve(RACINE, 'apps/api'),
      url: `http://localhost:${API_PORT}/health`,
      env: {
        NODE_ENV: 'development',
        PORT: String(API_PORT),
        DATABASE_URL,
        DOTENV_CONFIG_PATH: resolve(__dirname, 'e2e/.env.absent'),
        JWT_SECRET: 'e2e-test-secret-at-least-32-chars-long',
        JWT_REFRESH_SECRET: 'e2e-test-refresh-secret-at-least-32-chars',
        DB_ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        ALLOWED_ORIGINS: `http://localhost:${WEB_PORT}`,
        FRONTEND_URL: `http://localhost:${WEB_PORT}`,
        EMAIL_OTP_DEV_FALLBACK: 'true',
      },
      timeout: 240_000,
      reuseExistingServer: false,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: `npx ng serve --configuration=acceptance --port ${WEB_PORT} --host localhost`,
      cwd: __dirname,
      url: `http://localhost:${WEB_PORT}`,
      timeout: 240_000,
      reuseExistingServer: false,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
});

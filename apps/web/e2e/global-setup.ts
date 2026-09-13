// Avant tous les tests : schema a jour et jeu de donnees e2e en place.
// Rejouable : le seed est idempotent (apps/api/prisma/seed-e2e.ts).
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { API_ENV } from '../playwright.config';

const API_DIR = resolve(__dirname, '../../api');

function npx(args: string[]) {
  execFileSync('npx', args, {
    cwd: API_DIR,
    env: { ...process.env, ...API_ENV },
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
}

export default async function globalSetup() {
  console.log(`[e2e] base : ${API_ENV.DATABASE_URL.replace(/:[^:@/]+@/, ':***@')}`);
  npx(['prisma', 'migrate', 'deploy', '--config', 'prisma.config.ts']);
  npx(['tsx', 'prisma/seed-e2e.ts']);
}

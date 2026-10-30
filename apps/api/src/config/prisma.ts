import 'dotenv/config';
import { PrismaClient } from './generated/client/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { withFieldEncryption } from './prisma-encryption.extension';
import { optionsPool, surveillerPool } from './pool-options';
import { logger } from './logger';

// ─── Connexion PostgreSQL via Pool pg ─────────────────────
// Bornes explicites (attente, taille, inactivite, duree des requetes) et
// ecouteur d'erreur : voir pool-options.ts.
const pool = new Pool(optionsPool());
surveillerPool(pool, logger);

// ─── Adapter Prisma 7 ─────────────────────────────────────
const adapter = new PrismaPg(pool);

function createPrismaClient() {
  return withFieldEncryption(new PrismaClient({ adapter }));
}

// ─── Singleton Prisma Client ──────────────────────────────
const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
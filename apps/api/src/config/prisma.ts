import 'dotenv/config';
import { PrismaClient } from './generated/client/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// ─── Connexion PostgreSQL via Pool pg ─────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// ─── Adapter Prisma 7 ─────────────────────────────────────
const adapter = new PrismaPg(pool);

// ─── Singleton Prisma Client ──────────────────────────────
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
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

/**
 * Les colonnes qu'**aucune** requete ne lit sans le demander.
 *
 * Le hache du PIN USSD vit sur le profil patient, et le profil part entier
 * dans plusieurs reponses : `GET /patients/me`, l'export du dossier, la fiche
 * vue par un soignant. Sans cette exclusion, le hache sortait vers le
 * navigateur — et quatre chiffres haches se retrouvent en quelques secondes.
 * Seule la passerelle USSD le lit, en le demandant explicitement
 * (`omit: { pinUssdHash: false }`).
 */
export const OMISSIONS_GLOBALES = {
  patientProfile: { pinUssdHash: true },
} as const;

function createPrismaClient() {
  return withFieldEncryption(new PrismaClient({ adapter, omit: OMISSIONS_GLOBALES }));
}

// ─── Singleton Prisma Client ──────────────────────────────
const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
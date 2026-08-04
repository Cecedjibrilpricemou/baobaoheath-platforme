import 'dotenv/config';
import { PrismaClient, Role } from '../src/config/generated/client/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { hashPassword } from '../src/utils/password.utils.js';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seed BaoBaoHealth — compte SUPER_ADMIN uniquement...');

  const motDePasseHash = await hashPassword('baobao1234');

  await prisma.utilisateur.upsert({
    where: { telephone: '600000001' },
    update: {},
    create: {
      telephone: '600000001',
      email: 'cecedjibrilpricemou1er@gmail.com',
      motDePasseHash,
      prenom: 'Cécé',
      nom: 'Pricemou',
      role: Role.SUPER_ADMIN,
    },
  });

  console.log('✅ Seed terminé — tous les autres comptes seront créés via l\'application.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

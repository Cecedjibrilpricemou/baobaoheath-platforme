import 'dotenv/config';
import { PrismaClient, Role } from '../src/config/generated/client/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { hashPassword } from '../src/utils/password.utils.js';
import { seedExamens } from './seed-examens.js';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seed BaoBaoHealth — compte SUPER_ADMIN uniquement...');

  const motDePasseHash = await hashPassword('baobao1234');

  // Idempotent sur le telephone ET l'e-mail : le compte peut avoir change de
  // numero depuis l'application sans que le seed echoue.
  const email = 'cecedjibrilpricemou1er@gmail.com';
  const existant = await prisma.utilisateur.findFirst({ where: { OR: [{ telephone: '600000001' }, { email }] }, select: { id: true } });
  if (!existant) {
    await prisma.utilisateur.create({
      data: {
        telephone: '600000001',
        email,
        motDePasseHash,
        prenom: 'Cécé',
        nom: 'Pricemou',
        role: Role.SUPER_ADMIN,
      },
    });
  }

  const nbExamens = await seedExamens(prisma);
  console.log(`🧪 Referentiel des examens : ${nbExamens} codes LOINC.`);

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

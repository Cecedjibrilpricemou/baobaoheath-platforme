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

  // **Ni l'adresse ni le mot de passe ne vivent dans ce fichier.** Ils y
  // etaient en clair : une adresse Gmail personnelle et son mot de passe,
  // dans un depot public. Les retirer d'un fichier de documentation le 24
  // octobre n'avait rien regle -- le meme couple etait ici, suivi par git.
  //
  // Les defauts ne valent que pour une base de developpement : l'adresse est
  // en `@demo.test`, donc inexistante, et le mot de passe qui l'accompagne ne
  // vaut rien ailleurs. Pour un compte reel, passez les deux variables.
  const email = process.env.SEED_SUPER_ADMIN_EMAIL ?? 'super.admin@demo.test';
  const motDePasse = process.env.SEED_SUPER_ADMIN_PASSWORD ?? 'DevSeed@2026';
  const motDePasseHash = await hashPassword(motDePasse);

  // Idempotent sur le telephone ET l'e-mail : le compte peut avoir change de
  // numero depuis l'application sans que le seed echoue.
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

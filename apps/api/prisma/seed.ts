import 'dotenv/config';
import { PrismaClient, Role } from '../src/config/generated/client/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { hashPassword } from '../src/utils/password.utils.js';
import { seedExamens } from './seed-examens.js';
import { lireMotDePasseSuperAdmin } from './mot-de-passe-demo.js';

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
  // L'adresse par defaut est en `@demo.test`, donc inexistante. Le mot de passe,
  // lui, **n'a pas de defaut** : un defaut ecrit ici donnait a toute base creee
  // sans la variable un super administrateur au mot de passe public.
  //
  // Le compte n'est cree qu'une fois : relancer le script avec un autre mot de
  // passe ne change pas celui d'un compte existant. Le mot de passe n'est donc
  // exige que pour la creation : recharger le referentiel des examens sur une
  // base deja semee ne le demande pas.
  // `||` et non `??` : une ligne vide copiee de .env.example donne '' et non undefined.
  const email = process.env.SEED_SUPER_ADMIN_EMAIL || 'super.admin@demo.test';

  // Idempotent sur le telephone ET l'e-mail : le compte peut avoir change de
  // numero depuis l'application sans que le seed echoue.
  const existant = await prisma.utilisateur.findFirst({ where: { OR: [{ telephone: '600000001' }, { email }] }, select: { id: true } });
  if (!existant) {
    const motDePasseHash = await hashPassword(lireMotDePasseSuperAdmin());
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

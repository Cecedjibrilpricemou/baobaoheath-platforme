/**
 * Repositionne un mot de passe connu sur les comptes de démonstration.
 *
 * Ces comptes ont été créés depuis l'interface avec un mot de passe temporaire
 * affiché une seule fois : sans cela, aucun des espaces médecin, pharmacien ou
 * admin de structure n'est atteignable pour une vérification.
 *
 * Usage : npx tsx prisma/reset-demo-passwords.ts
 * À n'exécuter que sur une base de développement.
 */
import 'dotenv/config';
import { PrismaClient } from '../src/config/generated/client/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { hashPassword } from '../src/utils/password.utils.js';

const MOT_DE_PASSE = 'baobao1234';

const COMPTES_DEMO = [
  'medecin.demo@baobaohealth.test',
  'pharmacien.demo@baobaohealth.test',
  'admin.demo@baobaohealth.test',
  'ibrahima.conde@baobaotest.local',
  'sekou.traore@baobaotest.local',
  'mariam.sylla@baobaotest.local',
  'kadiatou.barry@baobaotest.local',
];

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refus : ce script ne doit pas tourner en production.');
  }

  const motDePasseHash = await hashPassword(MOT_DE_PASSE);

  for (const email of COMPTES_DEMO) {
    const resultat = await prisma.utilisateur.updateMany({
      where: { email },
      data: { motDePasseHash, doitChangerMotDePasse: false },
    });
    console.log(`${email} : ${resultat.count} compte(s) mis a jour`);
  }

  console.log(`\nMot de passe applique : ${MOT_DE_PASSE}`);
}

main()
  .catch((erreur) => {
    console.error(erreur);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

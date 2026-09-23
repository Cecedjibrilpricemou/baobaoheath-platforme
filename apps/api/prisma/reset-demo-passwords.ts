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

/**
 * Comptes vises, par e-mail ou par telephone : les patients se connectent avec
 * leur numero et n'ont pas tous une adresse.
 *
 * Les trois premieres adresses de la version precedente
 * (medecin.demo@baobaohealth.test et consorts) ne correspondaient a aucun
 * compte : le script annoncait « 0 compte(s) mis a jour » sans que personne ne
 * le remarque, et les espaces concernes restaient inaccessibles.
 */
const COMPTES_DEMO = [
  // Espace de demonstration complet (un role par adresse).
  'cecedjibrilpricemou1er+asc@gmail.com',
  'cecedjibrilpricemou1er+medecin@gmail.com',
  'cecedjibrilpricemou1er+pharma@gmail.com',
  'cecedjibrilpricemou1er+admin@gmail.com',
  'cecedjibrilpricemou1er+labo@gmail.com',
  'cecedjibrilpricemou1er+accueil@gmail.com',
  'cecedjibrilpricemou1er+tech@gmail.com',
  'cecedjibrilpricemou1er+bio@gmail.com',
  // Comptes de test historiques.
  'ousmane.bah@baobaotest.local',
  'sekou.traore@baobaotest.local',
  'mariam.sylla@baobaotest.local',
  'kadiatou.barry@baobaotest.local',
  // Patiente de reference, par telephone.
  '625444555',
];

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refus : ce script ne doit pas tourner en production.');
  }

  const motDePasseHash = await hashPassword(MOT_DE_PASSE);

  let introuvables = 0;

  for (const identifiant of COMPTES_DEMO) {
    const resultat = await prisma.utilisateur.updateMany({
      where: identifiant.includes('@') ? { email: identifiant } : { telephone: identifiant },
      data: { motDePasseHash, doitChangerMotDePasse: false },
    });
    if (resultat.count === 0) introuvables += 1;
    console.log(`${identifiant} : ${resultat.count} compte(s) mis a jour`);
  }

  // Un identifiant obsolete doit se voir : sinon le script « reussit » en ne
  // faisant rien, et l'espace concerne reste inaccessible.
  if (introuvables > 0) {
    console.warn(`
[!] ${introuvables} identifiant(s) sans compte correspondant — liste a mettre a jour.`);
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

// Jeu de donnees des tests end-to-end (apps/web/e2e). Idempotent : chaque
// entree est identifiee par une cle stable et peut etre rejouee sur une base
// deja peuplee. Reserve aux bases jetables (CI, docker local) — les comptes
// ont un mot de passe connu.
import 'dotenv/config';
import { PrismaClient, Role, TypeStructure } from '../src/config/generated/client/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { hashPassword } from '../src/utils/password.utils.js';
import { seedExamens } from './seed-examens.js';

export const E2E = {
  motDePasse: 'E2e-Password-123',
  prefecture: 'Kindia',
  centre: { nom: 'Centre de sante e2e', telephone: '+224600100001' },
  pharmacie: { nom: 'Pharmacie e2e', telephone: '+224600100002' },
  laboratoire: { nom: 'Laboratoire e2e', telephone: '+224600100003' },
  asc: { email: 'asc.e2e@baobao.test', telephone: '690000001', prenom: 'Mamadou', nom: 'Bah' },
  medecin: { email: 'medecin.e2e@baobao.test', telephone: '690000002', prenom: 'Fatoumata', nom: 'Camara' },
  pharmacien: { email: 'pharma.e2e@baobao.test', telephone: '690000003', prenom: 'Ibrahima', nom: 'Sow' },
  adminStructure: { email: 'admin.centre.e2e@baobao.test', telephone: '690000004', prenom: 'Aissatou', nom: 'Barry' },
  accueil: { email: 'accueil.e2e@baobao.test', telephone: '690000005', prenom: 'Kadiatou', nom: 'Toure' },
  biologiste: { email: 'biologiste.e2e@baobao.test', telephone: '690000006', prenom: 'Sekou', nom: 'Camara' },
  patient: { telephone: '690000010', prenom: 'Awa', nom: 'Diallo', qrCode: 'E2E-QR-AWA-0001' },
  medicament: { dci: 'Paracetamol', nomCommercial: 'Doliprane e2e', forme: 'comprime', dosage: '500mg', prixUnitaireGnf: 1000, codeAtc: 'N02BE01' },
  // Molecule a laquelle la patiente se declare allergique : elle sert a
  // verifier que l'alerte de prescription (EF-05-05) arrive a l'ecran.
  allergene: { dci: 'Amoxicilline', nomCommercial: 'Clamoxyl e2e', forme: 'gelule', dosage: '500mg', prixUnitaireGnf: 2500, codeAtc: 'J01CA04' },
  // Produit a circuit reglemente (EF-05-12) : ni renouvelable, validite
  // reduite, signature d'un medecin exigee.
  reglemente: { dci: 'Morphine', nomCommercial: 'Morphine e2e', forme: 'ampoule', dosage: '10mg', prixUnitaireGnf: 8000, codeAtc: 'N02AA01', estReglemente: true },
} as const;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function upsertStructure(nom: string, type: TypeStructure, telephone: string) {
  const existante = await prisma.structureSante.findFirst({ where: { nom } });
  if (existante) return existante;
  return prisma.structureSante.create({
    data: { nom, type, prefecture: E2E.prefecture, telephone, estActive: true },
  });
}

async function upsertUtilisateur(
  u: { email?: string; telephone: string; prenom: string; nom: string },
  role: Role,
  motDePasseHash: string,
  idStructure: string | null,
) {
  return prisma.utilisateur.upsert({
    where: { telephone: u.telephone },
    update: { estActif: true, idStructure, motDePasseHash },
    create: {
      telephone: u.telephone,
      email: u.email ?? null,
      motDePasseHash,
      prenom: u.prenom,
      nom: u.nom,
      role,
      idStructure,
    },
  });
}

async function main() {
  console.log('Seed e2e — structures, comptes ASC / medecin / pharmacien, patient, medicament, stock...');

  const motDePasseHash = await hashPassword(E2E.motDePasse);

  const centre = await upsertStructure(E2E.centre.nom, TypeStructure.CENTRE, E2E.centre.telephone);
  const pharmacie = await upsertStructure(E2E.pharmacie.nom, TypeStructure.PHARMACIE, E2E.pharmacie.telephone);
  const laboratoire = await upsertStructure(E2E.laboratoire.nom, TypeStructure.LABORATOIRE, E2E.laboratoire.telephone);
  await seedExamens(prisma);

  const asc = await upsertUtilisateur(E2E.asc, Role.ASC, motDePasseHash, centre.id);
  const ascProfile = await prisma.ascProfile.upsert({
    where: { idUtilisateur: asc.id },
    update: { idStructure: centre.id },
    create: { idUtilisateur: asc.id, idStructure: centre.id, numeroCertification: 'E2E-ASC-001' },
  });

  const medecin = await upsertUtilisateur(E2E.medecin, Role.MEDECIN, motDePasseHash, centre.id);
  await prisma.medecinProfile.upsert({
    where: { idUtilisateur: medecin.id },
    update: { idStructure: centre.id },
    create: { idUtilisateur: medecin.id, idStructure: centre.id, specialite: 'Medecine generale' },
  });

  // Administre le centre : voit ses agents (ASC + medecin) et ses statistiques.
  await upsertUtilisateur(E2E.adminStructure, Role.ADMIN_STRUCTURE, motDePasseHash, centre.id);

  // Accueil du centre : admission, episodes, demandes d'analyse (P1).
  await upsertUtilisateur(E2E.accueil, Role.AGENT_ACCUEIL, motDePasseHash, centre.id);
  // Biologiste du laboratoire : prelevement, resultats, validation (P2).
  await upsertUtilisateur(E2E.biologiste, Role.BIOLOGISTE, motDePasseHash, laboratoire.id);

  const pharmacien = await upsertUtilisateur(E2E.pharmacien, Role.PHARMACIEN, motDePasseHash, pharmacie.id);
  await prisma.pharmacienProfile.upsert({
    where: { idUtilisateur: pharmacien.id },
    update: { idStructure: pharmacie.id },
    create: { idUtilisateur: pharmacien.id, idStructure: pharmacie.id, estResponsable: true },
  });

  // Un ASC ne voit que ses patients (access-control.service) : Awa est sa
  // patiente attitree, rattachee au centre.
  const patientUser = await upsertUtilisateur(E2E.patient, Role.PATIENT, motDePasseHash, null);
  const rattachement = { idAscPrincipal: ascProfile.id, idStructurePreferee: centre.id };
  await prisma.patientProfile.upsert({
    where: { idUtilisateur: patientUser.id },
    update: {
      qrCode: E2E.patient.qrCode, prefecture: E2E.prefecture,
      allergies: [E2E.allergene.dci],
      ...rattachement,
    },
    create: {
      idUtilisateur: patientUser.id,
      qrCode: E2E.patient.qrCode,
      dateNaissance: new Date('1990-05-01'),
      sexe: 'F',
      prefecture: E2E.prefecture,
      allergies: [E2E.allergene.dci],
      maladiesChroniques: [],
      ...rattachement,
    },
  });

  let medicament = await prisma.medicament.findFirst({ where: { nomCommercial: E2E.medicament.nomCommercial } });
  if (!medicament) {
    medicament = await prisma.medicament.create({ data: { ...E2E.medicament, listeEssentielle: true } });
  }

  const allergene = await prisma.medicament.findFirst({ where: { nomCommercial: E2E.allergene.nomCommercial } });
  if (!allergene) {
    await prisma.medicament.create({ data: { ...E2E.allergene, listeEssentielle: false } });
  }

  const reglemente = await prisma.medicament.findFirst({ where: { nomCommercial: E2E.reglemente.nomCommercial } });
  if (!reglemente) {
    await prisma.medicament.create({ data: { ...E2E.reglemente, listeEssentielle: false } });
  }

  // La pharmacie doit avoir du stock pour delivrer ; l'ASC n'en a pas encore
  // (le test d'ajout de stock le cree).
  await prisma.stock.upsert({
    where: { idStructure_idMedicament: { idStructure: pharmacie.id, idMedicament: medicament.id } },
    update: { quantite: 500 },
    create: { idStructure: pharmacie.id, idMedicament: medicament.id, quantite: 500, unite: 'boite', seuilAlerte: 10 },
  });

  console.log('Seed e2e termine.');
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

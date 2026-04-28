// prisma/seed.ts
import 'dotenv/config';
import { PrismaClient, Role, TypeStructure } from '../src/config/generated/client/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { hashPassword } from '../src/utils/password.utils.js';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Démarrage du seed BaoBaoHealth...\n');

  const hash = await hashPassword('baobao1234');

  // ── 1. STRUCTURES DE SANTE DE GUINEE ─────────────────────────
  console.log('🏥 Création des structures de santé...');

  const structures = await Promise.all([
    upsertStructure('CHU de Conakry', TypeStructure.CHU, 'Conakry', 9.5370, -13.6773),
    upsertStructure('Hôpital National Ignace Deen', TypeStructure.HOPITAL_REG, 'Conakry', 9.5404, -13.6772),
    upsertStructure('Centre de Santé de Matam', TypeStructure.CENTRE, 'Conakry', 9.5275, -13.6682),
    upsertStructure('Centre de Santé de Ratoma', TypeStructure.CENTRE, 'Conakry', 9.5869, -13.6483),
    upsertStructure('Hôpital Régional de Kindia', TypeStructure.HOPITAL_PREF, 'Kindia', 10.0564, -12.8606),
    upsertStructure('Centre de Santé de Coyah', TypeStructure.CENTRE, 'Coyah', 9.7021, -13.3732),
    upsertStructure('Hôpital Régional de Labé', TypeStructure.HOPITAL_PREF, 'Labé', 11.3181, -12.2868),
    upsertStructure('Hôpital Régional de Kankan', TypeStructure.HOPITAL_PREF, 'Kankan', 10.3836, -9.3056),
    upsertStructure('Pharmacie Centrale de Conakry', TypeStructure.PHARMACIE, 'Conakry', 9.5372, -13.6771),
    upsertStructure('Pharmacie Moderne Kaloum', TypeStructure.PHARMACIE, 'Conakry', 9.5248, -13.7011),
    upsertStructure('Pharmacie du Peuple Ratoma', TypeStructure.PHARMACIE, 'Conakry', 9.5869, -13.6484),
  ]);

  console.log(`✅ ${structures.length} structures créées\n`);

  const chuConakry = structures[0];
  const centreMatam = structures[2];
  const pharmacieCentrale = structures[8];

  // ── 2. MEDICAMENTS AVEC PRIX GUINEE ──────────────────────────
  console.log('💊 Création des médicaments...');

  await Promise.all([
    upsertMedicament('Paracétamol', '500mg', 'comprimé', 'Antipyrétique', 2500, true),
    upsertMedicament('Amoxicilline', '500mg', 'gélule', 'Antibiotique', 5000, true),
    upsertMedicament('Artéméther-Luméfantrine', '80/480mg', 'comprimé', 'Antipaludéen', 45000, true),
    upsertMedicament('Métronidazole', '250mg', 'comprimé', 'Antibiotique', 3000, true),
    upsertMedicament('Ibuprofène', '400mg', 'comprimé', 'Anti-inflammatoire', 3500, true),
    upsertMedicament('Oméprazole', '20mg', 'gélule', 'Gastroprotecteur', 8000, false),
    upsertMedicament('Cotrimoxazole', '480mg', 'comprimé', 'Antibiotique', 2000, true),
    upsertMedicament('Fer + Acide folique', '200mg', 'comprimé', 'Supplément', 1500, true),
    upsertMedicament('Vitamine C', '500mg', 'comprimé', 'Supplément', 1000, false),
    upsertMedicament('SRO', '1L', 'sachet', 'Réhydratation', 5000, true),
    upsertMedicament('Mébendazole', '500mg', 'comprimé', 'Antiparasitaire', 8000, true),
    upsertMedicament('Doxycycline', '100mg', 'gélule', 'Antibiotique', 4000, false),
    upsertMedicament('Chloroquine', '100mg', 'comprimé', 'Antipaludéen', 2500, true),
    upsertMedicament('Amoxicilline + Ac.Clav.', '625mg', 'comprimé', 'Antibiotique', 12000, false),
    upsertMedicament('Diazépam', '5mg', 'comprimé', 'Anxiolytique', 15000, false),
  ]);

  console.log('✅ Médicaments créés\n');

  // ── 3. COMPTES UTILISATEURS ──────────────────────────────────
  console.log('👥 Création des comptes...');

  // SUPER ADMIN
  await upsertUser('600000001', 'superadmin@baobao.gn', hash, 'Super', 'Admin', Role.SUPER_ADMIN, null);

  // ADMIN STRUCTURE — CHU Conakry
  await upsertUser('600000002', 'admin.chu@baobao.gn', hash, 'Aissatou', 'Baldé', Role.ADMIN_STRUCTURE, chuConakry.id);

  // MEDECIN — CHU Conakry
  const medecin = await upsertUser('600000003', 'dr.diallo@baobao.gn', hash, 'Mamadou', 'Diallo', Role.MEDECIN, chuConakry.id);
  await prisma.medecinProfile.upsert({
    where: { idUtilisateur: medecin.id },
    update: {},  // ← rien à mettre à jour, le profil médecin n'a pas de motDePasseHash
    create: { idUtilisateur: medecin.id, specialite: 'Médecine générale', numeroCom: 'ORD-001', idStructure: chuConakry.id }
  });

  // ASC — Centre Matam
  const asc = await upsertUser('600000004', 'asc.camara@baobao.gn', hash, 'Fatoumata', 'Camara', Role.ASC, centreMatam.id);
  await prisma.ascProfile.upsert({
    where: { idUtilisateur: asc.id },
    update: {},
    create: { idUtilisateur: asc.id, idStructure: centreMatam.id }
  });

  // PHARMACIEN — Pharmacie Centrale
  const pharmacien = await upsertUser('600000005', 'pharma.bah@baobao.gn', hash, 'Ibrahima', 'Bah', Role.PHARMACIEN, pharmacieCentrale.id);
  await prisma.pharmacienProfile.upsert({
    where: { idUtilisateur: pharmacien.id },
    update: {},
    create: { idUtilisateur: pharmacien.id, idStructure: pharmacieCentrale.id }
  });

  // PATIENT
  const patient = await upsertUser('600000006', 'patient.kouyate@email.com', hash, 'Ibrahim', 'Kouyaté', Role.PATIENT, null);
  await prisma.patientProfile.upsert({
    where: { idUtilisateur: patient.id },
    update: {},
    create: {
      idUtilisateur: patient.id,
      dateNaissance: new Date('1990-05-15'),
      sexe: 'M',
      prefecture: 'Conakry',
      sousPrefecture: 'Matam',
      groupeSanguin: 'O+',
      allergies: ['Pénicilline'],
      maladiesChroniques: [],
      idStructurePreferee: centreMatam.id
    }
  });

  console.log('✅ Comptes créés\n');

  console.log('════════════════════════════════════════════════════════════════');
  console.log('✅ Seed terminé ! Comptes de test :');
  console.log('════════════════════════════════════════════════════════════════');
  console.log('Rôle             | Téléphone  | Email                     | MDP');
  console.log('────────────────────────────────────────────────────────────────');
  console.log('SUPER_ADMIN      | 600000001  | superadmin@baobao.gn      | baobao1234');
  console.log('ADMIN_STRUCTURE  | 600000002  | admin.chu@baobao.gn       | baobao1234');
  console.log('MEDECIN          | 600000003  | dr.diallo@baobao.gn       | baobao1234');
  console.log('ASC              | 600000004  | asc.camara@baobao.gn      | baobao1234');
  console.log('PHARMACIEN       | 600000005  | pharma.bah@baobao.gn      | baobao1234');
  console.log('PATIENT          | 600000006  | patient.kouyate@email.com | baobao1234');
  console.log('════════════════════════════════════════════════════════════════');
}

async function upsertStructure(nom: string, type: TypeStructure, prefecture: string, lat: number, lng: number) {
  return prisma.structureSante.upsert({
    where: { id: `seed-${nom.replace(/\s+/g, '-').toLowerCase()}` },
    update: {},
    create: {
      id: `seed-${nom.replace(/\s+/g, '-').toLowerCase()}`,
      nom, type, prefecture,
      latitude: lat, longitude: lng,
      estActive: true
    }
  });
}

async function upsertMedicament(dci: string, dosage: string, forme: string, categorie: string, prixUnitaireGnf: number, listeEssentielle: boolean) {
  return prisma.medicament.upsert({
    where: { id: `seed-med-${dci.replace(/\s+/g, '-').toLowerCase()}-${dosage}` },
    update: { prixUnitaireGnf },
    create: {
      id: `seed-med-${dci.replace(/\s+/g, '-').toLowerCase()}-${dosage}`,
      dci, dosage, forme, categorie, prixUnitaireGnf, listeEssentielle, estActif: true
    }
  });
}

async function upsertUser(telephone: string, email: string, motDePasseHash: string, prenom: string, nom: string, role: Role, idStructure: string | null) {
  return prisma.utilisateur.upsert({
    where: { telephone },
    update: { motDePasseHash, email },
    create: { telephone, email, motDePasseHash, prenom, nom, role, idStructure }
  });
}

main()
  .catch(e => { console.error('❌ Erreur seed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
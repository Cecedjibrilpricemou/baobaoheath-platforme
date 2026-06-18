import 'dotenv/config';
import { PrismaClient, Role, TypeStructure } from '../src/config/generated/client/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { hashPassword } from '../src/utils/password.utils.js';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Début du seed BaoBaoHealth...');
  const motDePasseHash = await hashPassword('baobao1234');

  // 1. Super Admin
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

  // 2. Création d'une Pharmacie
  let pharmacie = await prisma.structureSante.findFirst({ where: { nom: 'Pharmacie Centrale' } });
  if (!pharmacie) {
    pharmacie = await prisma.structureSante.create({
      data: {
        nom: 'Pharmacie Centrale',
        type: TypeStructure.PHARMACIE,
        prefecture: 'Conakry',
      }
    });
  }

  // 3. Pharmacien
  const pharmacienUser = await prisma.utilisateur.upsert({
    where: { telephone: '600000004' },
    update: {},
    create: {
      telephone: '600000004',
      motDePasseHash,
      prenom: 'Lunaire',
      nom: 'Diallo',
      role: Role.PHARMACIEN,
      idStructure: pharmacie.id
    }
  });

  await prisma.pharmacienProfile.upsert({
    where: { idUtilisateur: pharmacienUser.id },
    update: {},
    create: {
      idUtilisateur: pharmacienUser.id,
      idStructure: pharmacie.id,
      estResponsable: true
    }
  });

  // 4. Medecin
  const medecinUser = await prisma.utilisateur.upsert({
    where: { telephone: '600000003' },
    update: {},
    create: {
      telephone: '600000003',
      motDePasseHash,
      prenom: 'Dr. Alpha',
      nom: 'Barry',
      role: Role.MEDECIN,
    }
  });

  // 5. Patient
  const patientUser = await prisma.utilisateur.upsert({
    where: { telephone: '600000002' },
    update: {},
    create: {
      telephone: '600000002',
      motDePasseHash,
      prenom: 'Mamadou',
      nom: 'Sow',
      role: Role.PATIENT,
    }
  });

  const patient = await prisma.patientProfile.upsert({
    where: { idUtilisateur: patientUser.id },
    update: {},
    create: {
      idUtilisateur: patientUser.id,
      qrCode: 'QR-TEST-12345',
      dateNaissance: new Date('1990-01-01'),
      sexe: 'M',
      groupeSanguin: 'O+',
      allergies: ['Pénicilline'],
      prefecture: 'Conakry'
    }
  });

  // 6. Consultation
  let consult = await prisma.consultation.findFirst({ where: { idPatient: patient.id } });
  if (!consult) {
    consult = await prisma.consultation.create({
      data: {
        idPatient: patient.id,
        idMedecinValideur: medecinUser.id,
        motifPrincipal: 'Paludisme',
        statut: 'TERMINEE'
      }
    });
  }

  // 7. Médicament
  let medicament = await prisma.medicament.findFirst({ where: { nomCommercial: 'Doliprane' } });
  if (!medicament) {
    medicament = await prisma.medicament.create({
      data: {
        dci: 'Paracétamol',
        nomCommercial: 'Doliprane',
        forme: 'Comprimé',
        dosage: '1000mg',
        prixUnitaireGnf: 5000,
      }
    });
  }

  // 8. Ordonnance
  let ordonnance = await prisma.ordonnance.findFirst({ where: { idConsultation: consult.id } });
  if (!ordonnance) {
    await prisma.ordonnance.create({
      data: {
        idConsultation: consult.id,
        idMedicament: medicament.id,
        signePar: medecinUser.id,
        posologie: '1 comprimé',
        frequence: '3 fois par jour',
        dureeJours: 5,
        quantite: 2,
        statut: 'EN_ATTENTE',
        signeLe: new Date()
      }
    });
  }

  console.log('✅ Seed terminé !');
  console.log('📌 Patient QR Code pour tester la Pharmacie : QR-TEST-12345');
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

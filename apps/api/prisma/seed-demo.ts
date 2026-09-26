// Jeu de demonstration « Pricemou », pour derouler le parcours complet a la
// main : hopital -> laboratoire -> consultation -> ordonnance -> pharmacie.
//
// Idempotent : chaque entree est identifiee par une cle stable (telephone,
// nom de structure, QR) et le script peut etre rejoue sans rien casser.
//
// Reserve aux bases de developpement : les comptes ont un mot de passe connu.
//
// Usage : npx tsx prisma/seed-demo.ts
import 'dotenv/config';
import { PrismaClient, Role, TypeStructure } from '../src/config/generated/client/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { hashPassword } from '../src/utils/password.utils.js';
import { seedExamens } from './seed-examens.js';

const MOT_DE_PASSE = 'Pricemou1234';

/**
 * Tout se joue dans le meme quartier : c'est la maille de l'appel aux
 * pharmacies (P6). Une pharmacie d'un autre quartier ne serait jamais
 * sollicitee, et le parcours s'arreterait la sans explication.
 */
const PREFECTURE = 'Conakry';
const COMMUNE = 'Dixinn';
const QUARTIER = 'Donka';

export const DEMO = {
  motDePasse: MOT_DE_PASSE,
  prefecture: PREFECTURE,
  commune: COMMUNE,
  quartier: QUARTIER,

  hopital: { nom: 'Hopital Donka', type: TypeStructure.CHU, telephone: '+224620000100' },
  laboratoire: { nom: 'Laboratoire Cece', type: TypeStructure.LABORATOIRE, telephone: '+224620000200' },
  pharmacie: { nom: 'Pharmacie Pricemou', type: TypeStructure.PHARMACIE, telephone: '+224620000300' },

  // Un compte par metier du parcours : chacun ouvre un espace different.
  accueil:    { telephone: '620100001', email: 'accueil.donka@demo.test',   prenom: 'Fatoumata', nom: 'Keita' },
  medecin:    { telephone: '620100002', email: 'david.medecin@demo.test',   prenom: 'David',     nom: 'Camara' },
  technicien: { telephone: '620100003', email: 'tech.cece@demo.test',       prenom: 'Sekou',     nom: 'Cece' },
  biologiste: { telephone: '620100004', email: 'bio.cece@demo.test',        prenom: 'Aminata',   nom: 'Cece' },
  pharmacien: { telephone: '620100005', email: 'pharma.pricemou@demo.test', prenom: 'Ousmane',   nom: 'Pricemou' },
  adminHopital: { telephone: '620100006', email: 'admin.donka@demo.test',   prenom: 'Mariama',   nom: 'Sow' },

  // Le patient se connecte avec son telephone, sans OTP.
  patient: {
    telephone: '620100010',
    prenom: 'Maomou', nom: 'Conde',
    qrCode: 'DEMO-QR-MAOMOU-0001',
    dateNaissance: new Date('1992-03-17'),
    sexe: 'F',
    // Declaree pour que l'alerte de prescription (EF-05-05) se declenche sur
    // l'amoxicilline, et par famille ATC sur l'ampicilline.
    allergies: ['Amoxicilline'],
    maladiesChroniques: ['Asthme'],
  },

  medicaments: [
    { dci: 'Paracetamol',  nomCommercial: 'Doliprane Pricemou', forme: 'comprime', dosage: '500mg', prixUnitaireGnf: 1000, codeAtc: 'N02BE01' },
    { dci: 'Amoxicilline', nomCommercial: 'Clamoxyl Pricemou',  forme: 'gelule',   dosage: '500mg', prixUnitaireGnf: 2500, codeAtc: 'J01CA04' },
    { dci: 'Metformine',   nomCommercial: 'Glucophage Pricemou', forme: 'comprime', dosage: '850mg', prixUnitaireGnf: 1800, codeAtc: 'A10BA02',
      contreIndications: ['Insuffisance renale'] },
    { dci: 'Morphine',     nomCommercial: 'Morphine Pricemou',  forme: 'ampoule',  dosage: '10mg',  prixUnitaireGnf: 8000, codeAtc: 'N02AA01', estReglemente: true },
  ],
} as const;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function upsertStructure(
  s: { nom: string; type: TypeStructure; telephone: string },
  estPartenaire: boolean
) {
  const existante = await prisma.structureSante.findFirst({ where: { nom: s.nom } });
  const donnees = {
    type: s.type,
    prefecture: PREFECTURE,
    commune: COMMUNE,
    // Sans quartier, l'appel aux pharmacies (P6) ne trouve personne.
    quartier: QUARTIER,
    telephone: s.telephone,
    estActive: true,
    estPartenaire,
    partenaireDepuis: estPartenaire ? new Date() : null,
  };
  if (existante) {
    return prisma.structureSante.update({ where: { id: existante.id }, data: donnees });
  }
  return prisma.structureSante.create({ data: { nom: s.nom, ...donnees } });
}

async function upsertUtilisateur(
  u: { telephone: string; email?: string; prenom: string; nom: string },
  role: Role,
  motDePasseHash: string,
  idStructure: string | null
) {
  return prisma.utilisateur.upsert({
    where: { telephone: u.telephone },
    update: { estActif: true, idStructure, motDePasseHash, role, doitChangerMotDePasse: false },
    create: {
      telephone: u.telephone,
      email: u.email ?? null,
      motDePasseHash,
      prenom: u.prenom,
      nom: u.nom,
      role,
      idStructure,
      estActif: true,
      doitChangerMotDePasse: false,
    },
  });
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refus : ce script ne doit pas tourner en production.');
  }

  const motDePasseHash = await hashPassword(MOT_DE_PASSE);

  // ── 1. Les structures ───────────────────────────────────────────
  // La pharmacie est partenaire : c'est la condition pour etre sollicitee.
  const hopital = await upsertStructure(DEMO.hopital, false);
  const laboratoire = await upsertStructure(DEMO.laboratoire, true);
  const pharmacie = await upsertStructure(DEMO.pharmacie, true);
  console.log('1. Structures : Hopital Donka, Laboratoire Cece, Pharmacie Pricemou (partenaire)');

  // ── 2. Les professionnels ───────────────────────────────────────
  await upsertUtilisateur(DEMO.adminHopital, Role.ADMIN_STRUCTURE, motDePasseHash, hopital.id);
  await upsertUtilisateur(DEMO.accueil, Role.AGENT_ACCUEIL, motDePasseHash, hopital.id);
  const medecin = await upsertUtilisateur(DEMO.medecin, Role.MEDECIN, motDePasseHash, hopital.id);
  await upsertUtilisateur(DEMO.technicien, Role.TECHNICIEN_LABO, motDePasseHash, laboratoire.id);
  await upsertUtilisateur(DEMO.biologiste, Role.BIOLOGISTE, motDePasseHash, laboratoire.id);
  await upsertUtilisateur(DEMO.pharmacien, Role.PHARMACIEN, motDePasseHash, pharmacie.id);

  // Le profil medecin est requis pour que l'espace medecin s'ouvre.
  await prisma.medecinProfile.upsert({
    where: { idUtilisateur: medecin.id },
    update: {},
    create: { idUtilisateur: medecin.id, specialite: 'Medecine generale' },
  });
  console.log('2. Professionnels : accueil, Dr David, technicien, biologiste, pharmacien, admin');

  // ── 3. Le patient ───────────────────────────────────────────────
  const utilisateurPatient = await upsertUtilisateur(DEMO.patient, Role.PATIENT, motDePasseHash, null);
  const donneesPatient = {
    dateNaissance: DEMO.patient.dateNaissance,
    sexe: DEMO.patient.sexe,
    prefecture: PREFECTURE,
    commune: COMMUNE,
    // Meme quartier que la pharmacie : sans cela, aucune ne serait sollicitee.
    quartier: QUARTIER,
    allergies: [...DEMO.patient.allergies],
    maladiesChroniques: [...DEMO.patient.maladiesChroniques],
  };
  await prisma.patientProfile.upsert({
    where: { idUtilisateur: utilisateurPatient.id },
    update: donneesPatient,
    create: { idUtilisateur: utilisateurPatient.id, qrCode: DEMO.patient.qrCode, ...donneesPatient },
  });
  console.log(`3. Patiente : Maomou Conde (${DEMO.patient.telephone}), allergique a l'amoxicilline`);

  // ── 4. Le catalogue et le stock ─────────────────────────────────
  for (const m of DEMO.medicaments) {
    const existant = await prisma.medicament.findFirst({ where: { nomCommercial: m.nomCommercial } });
    const medicament = existant
      ? await prisma.medicament.update({ where: { id: existant.id }, data: { ...m } })
      : await prisma.medicament.create({ data: { ...m, listeEssentielle: true } });

    // La pharmacie doit avoir du stock, sinon la delivrance echoue.
    await prisma.stock.upsert({
      where: { idStructure_idMedicament: { idStructure: pharmacie.id, idMedicament: medicament.id } },
      update: { quantite: 500 },
      create: { idStructure: pharmacie.id, idMedicament: medicament.id, quantite: 500, unite: 'boite', seuilAlerte: 10 },
    });
  }
  console.log('4. Catalogue : 4 medicaments, dont un allergene et un reglemente, en stock');

  // ── 5. Le referentiel d'examens ─────────────────────────────────
  await seedExamens(prisma);
  console.log('5. Examens de laboratoire (codes LOINC)');

  console.log(`\nMot de passe de tous les comptes : ${MOT_DE_PASSE}`);
  console.log(`Quartier commun : ${QUARTIER} (${COMMUNE}, ${PREFECTURE})`);
  console.log('\nParcours a derouler : voir docs/PARCOURS-DEMO.md');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

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
  // Deuxieme laborantin : c'est lui qui valide, le role de biologiste ayant
  // ete supprime le 2026-09-30 (addendum, point 4).
  laborantin2: { telephone: '620100004', email: 'bio.cece@demo.test',      prenom: 'Aminata',   nom: 'Cece' },
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
    { libelle: 'Doliprane Pricemou 500mg', dci: 'Paracetamol',  nomCommercial: 'Doliprane Pricemou', forme: 'comprime', dosage: '500mg', prixUnitaireGnf: 1000, codeAtc: 'N02BE01' },
    { libelle: 'Clamoxyl Pricemou 500mg', dci: 'Amoxicilline', nomCommercial: 'Clamoxyl Pricemou',  forme: 'gelule',   dosage: '500mg', prixUnitaireGnf: 2500, codeAtc: 'J01CA04' },
    { libelle: 'Glucophage Pricemou 850mg', dci: 'Metformine',   nomCommercial: 'Glucophage Pricemou', forme: 'comprime', dosage: '850mg', prixUnitaireGnf: 1800, codeAtc: 'A10BA02',
      contreIndications: ['Insuffisance renale'] },
    { libelle: 'Morphine Pricemou 10mg', dci: 'Morphine',     nomCommercial: 'Morphine Pricemou',  forme: 'ampoule',  dosage: '10mg',  prixUnitaireGnf: 8000, codeAtc: 'N02AA01', estReglemente: true },
  ],

  // Articles non medicamenteux (decision du 2026-10-01). Ni DCI, ni forme, ni
  // dosage : c'est precisement ce que l'ancien modele ne savait pas porter.
  // Ils ne se prescrivent pas ; ils se vendent au comptoir, et l'assurance
  // s'appuie sur leur categorie pour les exclure.
  articles: [
    { libelle: 'Lait infantile 1er age 400g', categorie: 'LAIT_INFANTILE', prixUnitaireGnf: 45000 },
    { libelle: 'Creme hydratante 100ml',      categorie: 'COSMETIQUE',     prixUnitaireGnf: 30000 },
    { libelle: 'Savon antiseptique',          categorie: 'HYGIENE',        prixUnitaireGnf: 12000 },
    { libelle: 'Thermometre digital',         categorie: 'DISPOSITIF_MEDICAL', prixUnitaireGnf: 85000 },
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
  await upsertUtilisateur(DEMO.laborantin2, Role.TECHNICIEN_LABO, motDePasseHash, laboratoire.id);
  await upsertUtilisateur(DEMO.pharmacien, Role.PHARMACIEN, motDePasseHash, pharmacie.id);

  // Le profil medecin est requis pour que l'espace medecin s'ouvre.
  await prisma.medecinProfile.upsert({
    where: { idUtilisateur: medecin.id },
    update: {},
    create: { idUtilisateur: medecin.id, specialite: 'Medecine generale' },
  });
  console.log('2. Professionnels : accueil, Dr David, deux laborantins, pharmacien, admin');

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

  /**
   * Met un produit en stock dans l'officine, avec son lot. Une quantite sans
   * lot est indelivrable depuis le 2026-09-30 : la sortie se fait au plus
   * proche de la peremption.
   *
   * Semence rejouable : un lot unique, refait a chaque execution. Empiler un
   * lot de plus a chaque passage ferait quitter la quantite du stock.
   */
  async function mettreEnStock(idProduit: string, cleLot: string, quantite = 500) {
    const stock = await prisma.stock.upsert({
      where: { idStructure_idMedicament: { idStructure: pharmacie.id, idMedicament: idProduit } },
      update: {},
      create: { idStructure: pharmacie.id, idMedicament: idProduit, quantite, unite: 'boite', seuilAlerte: 10 },
    });

    // Un stock qui porte deja une entree enregistree par facture n'est plus un
    // stock de semence : le remettre a 500 et refaire ses lots effacerait
    // l'approvisionnement, et la facture se retrouverait sans ses lots. On le
    // laisse tel quel.
    const dejaApprovisionne = await prisma.lotStock.count({
      where: { idStock: stock.id, idApprovisionnement: { not: null } },
    });
    if (dejaApprovisionne > 0) return;

    await prisma.stock.update({ where: { id: stock.id }, data: { quantite } });
    await prisma.lotStock.deleteMany({ where: { idStock: stock.id } });
    await prisma.lotStock.create({
      data: {
        idStock: stock.id,
        numeroLot: `DEMO-${cleLot.slice(0, 6).toUpperCase()}-1`,
        quantite,
        quantiteRecue: quantite,
        // Quatre mois : l'ecran des peremptions a quelque chose a montrer sans
        // qu'on ait a saisir une facture d'abord.
        datePeremption: new Date(Date.now() + 120 * 86_400_000),
      },
    });
  }

  for (const m of DEMO.medicaments) {
    const existant = await prisma.medicament.findFirst({ where: { nomCommercial: m.nomCommercial } });
    const medicament = existant
      ? await prisma.medicament.update({ where: { id: existant.id }, data: { ...m } })
      : await prisma.medicament.create({ data: { ...m, listeEssentielle: true } });

    await mettreEnStock(medicament.id, medicament.nomCommercial ?? 'LOT');
  }

  // Les articles se reperent par leur libelle : n'ayant pas de nom commercial,
  // ils n'ont pas d'autre cle stable.
  for (const a of DEMO.articles) {
    const existant = await prisma.medicament.findFirst({ where: { libelle: a.libelle } });
    const article = existant
      ? await prisma.medicament.update({ where: { id: existant.id }, data: { ...a } })
      : await prisma.medicament.create({ data: { ...a } });
    await mettreEnStock(article.id, a.libelle.replace(/\s/g, ''), 60);
  }

  console.log(
    `4. Catalogue : ${DEMO.medicaments.length} medicaments (dont un allergene et un reglemente) ` +
      `et ${DEMO.articles.length} articles non medicamenteux, en stock par lots`
  );

  // ── 5. Le referentiel d'examens ─────────────────────────────────
  await seedExamens(prisma);
  console.log('5. Examens de laboratoire (codes LOINC)');

  await verifierInvariantDesLots();

  console.log(`\nMot de passe de tous les comptes : ${MOT_DE_PASSE}`);
  console.log(`Quartier commun : ${QUARTIER} (${COMMUNE}, ${PREFECTURE})`);
  console.log('\nParcours a derouler : voir docs/PARCOURS-DEMO.md');
}

/**
 * La quantite d'un stock est la somme de ses lots. Rien dans le schema ne
 * l'impose, et une semence qui l'oublie laisse une pharmacie incapable de
 * delivrer tout en affichant du stock. On echoue ici plutot qu'au milieu
 * d'une demonstration.
 */
async function verifierInvariantDesLots() {
  const stocks = await prisma.stock.findMany({ include: { lots: true } });
  const ecarts = stocks
    .map((s) => ({ id: s.id, quantite: s.quantite, lots: s.lots.reduce((t, l) => t + l.quantite, 0) }))
    .filter((e) => e.quantite !== e.lots);
  if (ecarts.length > 0) {
    throw new Error(
      'Stock sans lots ou lots incoherents : ' +
        ecarts.map((e) => `${e.id} (quantite=${e.quantite}, lots=${e.lots})`).join(', ')
    );
  }
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

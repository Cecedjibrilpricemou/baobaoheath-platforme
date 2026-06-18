import 'dotenv/config';
import { PrismaClient, Role, TypeStructure, EncounterStatus, NiveauAlerteEpidemique } from '../src/config/generated/client/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { hashPassword } from '../src/utils/password.utils.js';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🧹 Nettoyage de la base de données (sauf admin)...');
  
  // Suppression dans l'ordre pour respecter les clés étrangères
  await prisma.alerteEpidemique.deleteMany({});
  await prisma.vaccination.deleteMany({});
  await prisma.facture.deleteMany({});
  await prisma.ordonnance.deleteMany({});
  await prisma.medicament.deleteMany({});
  await prisma.diagnostic.deleteMany({});
  await prisma.constantesVitales.deleteMany({});
  await prisma.referencement.deleteMany({});
  await prisma.message.deleteMany({});
  await prisma.rendezVous.deleteMany({});
  await prisma.consultation.deleteMany({});
  
  await prisma.pharmacienProfile.deleteMany({});
  await prisma.medecinProfile.deleteMany({});
  await prisma.ascProfile.deleteMany({});
  await prisma.patientProfile.deleteMany({});
  
  await prisma.stock.deleteMany({});
  
  await prisma.session.deleteMany({});
  await prisma.authOtp.deleteMany({});
  await prisma.journalAudit.deleteMany({});
  
  // Ne supprimer que les utilisateurs qui ne sont pas SUPER_ADMIN
  await prisma.utilisateur.deleteMany({
    where: { role: { not: Role.SUPER_ADMIN } }
  });
  
  await prisma.structureSante.deleteMany({});

  console.log('🌱 Création des données mockées pour la démo...');
  
  const motDePasseHash = await hashPassword('password123'); // Même mot de passe pour tous
  
  // Structures
  const poste = await prisma.structureSante.create({
    data: { nom: 'Poste de Santé de Kassa', type: TypeStructure.POSTE, prefecture: 'Conakry', latitude: 9.5092, longitude: -13.7122 }
  });
  const centre = await prisma.structureSante.create({
    data: { nom: 'Centre Médical Ratoma', type: TypeStructure.CENTRE, prefecture: 'Conakry', latitude: 9.6000, longitude: -13.6500 }
  });
  const pharmacie = await prisma.structureSante.create({
    data: { nom: 'Pharmacie Centrale', type: TypeStructure.PHARMACIE, prefecture: 'Conakry' }
  });

  // Utilisateurs
  const emails = [
    { email: 'gourouprice@gmail.com', role: Role.ASC, prenom: 'Gourou', nom: 'Price', idStruct: poste.id },
    { email: 'tzoulou260@gmail.com', role: Role.MEDECIN, prenom: 'Tzoulou', nom: 'Docteur', idStruct: centre.id },
    { email: 'stfonciertest@gmail.com', role: Role.PHARMACIEN, prenom: 'Fonci', nom: 'Test', idStruct: pharmacie.id },
    { email: 'identiguinee@gmail.com', role: Role.PATIENT, prenom: 'Identi', nom: 'Guinee', idStruct: null },
    { email: 'teamsevent17n@gmail.com', role: Role.PATIENT, prenom: 'Team', nom: 'Sevent', idStruct: null },
    { email: 'nexustech1er@gmail.com', role: Role.ADMIN_STRUCTURE, prenom: 'Nexus', nom: 'Tech', idStruct: centre.id },
    { email: 'iaok13215@gmail.com', role: Role.ASC_SUPERVISOR, prenom: 'Iao', nom: 'Super', idStruct: centre.id }
  ];

  let telCounter = 620000000;
  const users: Record<string, any[]> = {};

  for (const u of emails) {
    const user = await prisma.utilisateur.create({
      data: {
        email: u.email,
        telephone: (telCounter++).toString(),
        motDePasseHash,
        prenom: u.prenom,
        nom: u.nom,
        role: u.role,
        idStructure: u.idStruct
      }
    });
    users[u.role] = users[u.role] || [];
    users[u.role].push(user);
    
    // Créer les profils
    if (u.role === Role.ASC) {
      await prisma.ascProfile.create({ data: { idUtilisateur: user.id, idStructure: u.idStruct } });
    } else if (u.role === Role.MEDECIN) {
      await prisma.medecinProfile.create({ data: { idUtilisateur: user.id, idStructure: u.idStruct, specialite: 'Généraliste' } });
    } else if (u.role === Role.PHARMACIEN) {
      await prisma.pharmacienProfile.create({ data: { idUtilisateur: user.id, idStructure: u.idStruct, estResponsable: true } });
    } else if (u.role === Role.PATIENT) {
      await prisma.patientProfile.create({ 
        data: { 
          idUtilisateur: user.id, 
          qrCode: `QR-${u.nom}-${Date.now()}`, 
          dateNaissance: new Date('1990-01-01'), 
          sexe: 'M', 
          prefecture: 'Conakry' 
        } 
      });
    }
  }

  // Création de données pour le Dashboard (Alertes, Vaccins, Consultations)
  await prisma.alerteEpidemique.createMany({
    data: [
      { pathologie: 'Paludisme', prefecture: 'Conakry', nombre: 45, seuil: 30, niveau: NiveauAlerteEpidemique.URGENCE, dateDetection: new Date() },
      { pathologie: 'Choléra', prefecture: 'Kindia', nombre: 12, seuil: 10, niveau: NiveauAlerteEpidemique.ALERTE, dateDetection: new Date() },
      { pathologie: 'Ebola (Suspect)', prefecture: 'Nzérékoré', nombre: 2, seuil: 1, niveau: NiveauAlerteEpidemique.URGENCE, dateDetection: new Date() }
    ]
  });

  const patientProfile = await prisma.patientProfile.findFirst({ where: { utilisateur: { email: 'identiguinee@gmail.com' } } });
  const medecinUser = users[Role.MEDECIN][0];
  const ascUser = users[Role.ASC][0];
  const ascProfile = await prisma.ascProfile.findFirst({ where: { idUtilisateur: ascUser.id } });

  if (patientProfile && ascProfile) {
    // 10 Vaccinations pour les stats
    for (let i = 0; i < 10; i++) {
      await prisma.vaccination.create({
        data: {
          vaccinNom: i % 2 === 0 ? 'BCG' : 'Polio',
          idPatient: patientProfile.id,
          idAdministrePar: ascUser.id,
          administreLe: new Date(Date.now() - i * 86400000)
        }
      });
    }

    // 15 Consultations avec IA
    for (let i = 0; i < 15; i++) {
      const c = await prisma.consultation.create({
        data: {
          idPatient: patientProfile.id,
          idAsc: ascProfile.id,
          idMedecinValideur: medecinUser.id,
          motifPrincipal: i % 3 === 0 ? 'Fièvre' : 'Toux',
          statut: i === 0 ? EncounterStatus.EN_COURS : EncounterStatus.TERMINEE,
          confianceIa: 85 + i,
          resumeIa: 'Suspicion de paludisme modéré.',
          symptomes: ['Fièvre', 'Maux de tête'],
          consulteeLE: new Date(Date.now() - i * 86400000)
        }
      });
      
      await prisma.constantesVitales.create({
        data: {
          idConsultation: c.id,
          temperature: 38.5,
          tensionSystolique: 120,
          tensionDiastolique: 80,
        }
      });
      
      await prisma.diagnostic.create({
        data: {
          idConsultation: c.id,
          libelle: 'Paludisme simple',
          source: 'IA'
        }
      });
    }

    // 5 Factures
    for (let i = 0; i < 5; i++) {
      await prisma.facture.create({
        data: {
          montantGnf: 50000 + i * 10000,
          statut: 'PAYEE',
          idPatient: patientProfile.id,
          creeLe: new Date(Date.now() - i * 86400000)
        }
      });
    }
  }

  console.log('✅ Seed avec données mockées terminé avec succès !');
  console.log('----------------------------------------------------');
  console.log('🔑 TOUS les comptes ont ce mot de passe : password123');
  console.log('----------------------------------------------------');
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

import { PrismaClient } from '../src/config/generated/client/client.js';
import 'dotenv/config';

const prisma = new PrismaClient();

async function main() {
  const patients = await prisma.patientProfile.findMany({ include: { utilisateur: true }});
  console.log('Patients:', patients.map(p => ({ qrCode: p.qrCode, nom: p.utilisateur.nom, prenom: p.utilisateur.prenom })));
  
  const ordos = await prisma.ordonnance.findMany({ include: { medicament: true, patient: true } });
  console.log('Ordonnances:', ordos.map(o => ({ id: o.id, statut: o.statut, medicament: o.medicament.nomCommercial })));
}

main().catch(console.error).finally(() => prisma.$disconnect());

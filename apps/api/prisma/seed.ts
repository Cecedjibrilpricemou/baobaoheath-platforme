// prisma/seed.ts
import 'dotenv/config';
import { PrismaClient, Role } from '../src/config/generated/client/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { hashPassword } from '../src/utils/password.utils.js';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log('🌱 Démarrage du seed...');

    const hash = await hashPassword('baobao1234');

    // ── SUPER ADMIN ──────────────────────────────────────────
    await upsert('600000001', hash, 'Super', 'Admin', Role.SUPER_ADMIN);

    // ── ADMIN STRUCTURE ──────────────────────────────────────
    await upsert('600000002', hash, 'Aissatou', 'Baldé', Role.ADMIN_STRUCTURE);

    // ── MEDECIN ──────────────────────────────────────────────
    const medecin = await upsert('600000003', hash, 'Mamadou', 'Diallo', Role.MEDECIN);
    await prisma.medecinProfile.upsert({
        where: { idUtilisateur: medecin.id },
        update: {},
        create: { idUtilisateur: medecin.id, specialite: 'Médecine générale', numeroCom: 'ORD-001' }
    });

    // ── ASC ───────────────────────────────────────────────────
    const asc = await upsert('600000004', hash, 'Fatoumata', 'Camara', Role.ASC);
    await prisma.ascProfile.upsert({
        where: { idUtilisateur: asc.id },
        update: {},
        create: { idUtilisateur: asc.id }
    });

    // ── PATIENT ───────────────────────────────────────────────
    const patient = await upsert('600000005', hash, 'Ibrahim', 'Kouyaté', Role.PATIENT);
    await prisma.patientProfile.upsert({
        where: { idUtilisateur: patient.id },
        update: {},
        create: {
            idUtilisateur: patient.id,
            dateNaissance: new Date('1990-05-15'),
            sexe: 'M',
            prefecture: 'Conakry',
            groupeSanguin: 'O+',
            allergies: ['Pénicilline'],
            maladiesChroniques: []
        }
    });

    console.log('\n✅ Seed terminé ! Comptes créés :');
    console.log('──────────────────────────────────────');
    console.log('Rôle             | Téléphone  | MDP');
    console.log('──────────────────────────────────────');
    console.log('SUPER_ADMIN      | 600000001  | baobao1234');
    console.log('ADMIN_STRUCTURE  | 600000002  | baobao1234');
    console.log('MEDECIN          | 600000003  | baobao1234');
    console.log('ASC              | 600000004  | baobao1234');
    console.log('PATIENT          | 600000005  | baobao1234');
    console.log('──────────────────────────────────────');
}

// update: { motDePasseHash } force la mise à jour du hash à chaque seed
async function upsert(telephone: string, motDePasseHash: string, prenom: string, nom: string, role: Role) {
    return prisma.utilisateur.upsert({
        where: { telephone },
        update: { motDePasseHash },
        create: { telephone, motDePasseHash, prenom, nom, role }
    });
}

main()
    .catch(e => { console.error('❌ Erreur seed:', e); process.exit(1); })
    .finally(() => prisma.$disconnect());
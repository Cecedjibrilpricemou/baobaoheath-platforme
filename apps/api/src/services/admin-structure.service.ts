// src/services/admin-structure.service.ts
import { prisma } from '../config/prisma';
import { hashPassword } from '../utils/password.utils';
import { Role, TypeStructure } from '../config/generated/client/client';
import { envoyerEmailAdminStructure, envoyerEmailAgent } from './email.service';

const ROLES_AUTORISES: Role[] = [Role.ASC, Role.ASC_SUPERVISOR, Role.MEDECIN, Role.PHARMACIEN];

// ── Générer un mot de passe temporaire ───────────────────────────
function genererMotDePasseTemp(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let pwd = 'BaoBao@';
    for (let i = 0; i < 5; i++) {
        pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pwd;
}

// ── SUPER_ADMIN : créer structure + admin en une transaction ──────
export async function creerStructureAvecAdmin(dto: {
    nom: string; type: string; prefecture: string;
    adresse?: string; latitude?: number; longitude?: number; telephone?: string;
    admin: { prenom: string; nom: string; telephone: string; email?: string; };
}) {
    const typeValid = Object.values(TypeStructure).includes(dto.type as TypeStructure);
    if (!typeValid) throw new Error(`Type invalide : ${dto.type}`);

    const existingTel = await prisma.utilisateur.findUnique({ where: { telephone: dto.admin.telephone } });
    if (existingTel) throw new Error('Ce numéro de téléphone est déjà utilisé');

    if (dto.admin.email) {
        const existingEmail = await prisma.utilisateur.findUnique({ where: { email: dto.admin.email } });
        if (existingEmail) throw new Error('Cette adresse email est déjà utilisée');
    }

    const motDePasseTemp = genererMotDePasseTemp();
    const motDePasseHash = await hashPassword(motDePasseTemp);

    const result = await prisma.$transaction(async (tx) => {
        const structure = await tx.structureSante.create({
            data: {
                nom: dto.nom, type: dto.type as TypeStructure,
                prefecture: dto.prefecture, adresse: dto.adresse,
                latitude: dto.latitude, longitude: dto.longitude,
                telephone: dto.telephone, estActive: true
            }
        });

        const admin = await tx.utilisateur.create({
            data: {
                telephone: dto.admin.telephone,
                email: dto.admin.email ?? null,
                motDePasseHash,
                prenom: dto.admin.prenom,
                nom: dto.admin.nom,
                role: Role.ADMIN_STRUCTURE,
                idStructure: structure.id,
                doitChangerMotDePasse: true
            }
        });

        return { structure, admin };
    });

    // ── Envoi email si adresse disponible ────────────────────────────
    if (dto.admin.email) {
        try {
            await envoyerEmailAdminStructure({
                destinataire: dto.admin.email,
                prenomNom: `${dto.admin.prenom} ${dto.admin.nom}`,
                nomStructure: dto.nom,
                telephone: dto.admin.telephone,
                motDePasseTemporaire: motDePasseTemp
            });
        } catch (emailError) {
            // L'email échoue silencieusement — le compte est quand même créé
            console.error('Erreur envoi email admin structure:', emailError);
        }
    }

    return {
        structure: result.structure,
        admin: {
            id: result.admin.id,
            telephone: result.admin.telephone,
            email: result.admin.email,
            prenom: result.admin.prenom,
            nom: result.admin.nom,
            role: result.admin.role
        },
        motDePasseTemporaire: motDePasseTemp
    };
}

// ── SUPER_ADMIN : lister toutes les structures ────────────────────
export async function getStructures() {
    return prisma.structureSante.findMany({
        orderBy: { creeLe: 'desc' },
        include: {
            _count: { select: { utilisateurs: true } },
            utilisateurs: {
                where: { role: Role.ADMIN_STRUCTURE },
                select: { prenom: true, nom: true, telephone: true }
            }
        }
    });
}

// ── SUPER_ADMIN : modifier une structure ──────────────────────────
export async function modifierStructure(id: string, dto: {
    nom?: string; type?: string; prefecture?: string;
    adresse?: string; latitude?: number; longitude?: number;
    telephone?: string; estActive?: boolean;
}) {
    if (dto.type) {
        const typeValid = Object.values(TypeStructure).includes(dto.type as TypeStructure);
        if (!typeValid) throw new Error(`Type invalide : ${dto.type}`);
    }
    const { type, ...rest } = dto;
    return prisma.structureSante.update({
        where: { id },
        data: { ...rest, ...(type ? { type: type as TypeStructure } : {}) }
    });
}

// ── SUPER_ADMIN : désactiver une structure ────────────────────────
export async function supprimerStructure(id: string) {
    return prisma.structureSante.update({
        where: { id },
        data: { estActive: false }
    });
}

// ── ADMIN_STRUCTURE : lister ses agents ──────────────────────────
export async function getAgentsStructure(adminId: string) {
    const admin = await prisma.utilisateur.findUnique({
        where: { id: adminId }, include: { structure: true }
    });
    if (!admin?.idStructure) throw new Error('Aucune structure assignée');

    return prisma.utilisateur.findMany({
        where: { idStructure: admin.idStructure, role: { in: ROLES_AUTORISES }, estActif: true },
        select: { id: true, telephone: true, email: true, prenom: true, nom: true, role: true, creeLe: true, derniereConnexion: true },
        orderBy: { creeLe: 'desc' }
    });
}

// ── ADMIN_STRUCTURE : créer un agent avec MDP temporaire ─────────
export async function creerAgent(adminId: string, dto: {
    telephone: string; email?: string; motDePasse?: string;
    prenom: string; nom: string; role: Role;
}) {
    const admin = await prisma.utilisateur.findUnique({
        where: { id: adminId },
        include: { structure: true }
    });
    if (!admin?.idStructure) throw new Error('Aucune structure assignée');

    if (!ROLES_AUTORISES.includes(dto.role)) {
        throw new Error(`Vous ne pouvez pas créer un compte de type ${dto.role}`);
    }

    const existingTel = await prisma.utilisateur.findUnique({ where: { telephone: dto.telephone } });
    if (existingTel) throw new Error('Ce numéro de téléphone est déjà utilisé');

    if (dto.email) {
        const existingEmail = await prisma.utilisateur.findUnique({ where: { email: dto.email } });
        if (existingEmail) throw new Error('Cette adresse email est déjà utilisée');
    }

    const motDePasseTemp = dto.motDePasse || genererMotDePasseTemp();
    const motDePasseHash = await hashPassword(motDePasseTemp);
    const isTemporaire = !dto.motDePasse;

    const user = await prisma.$transaction(async (tx) => {
        const u = await tx.utilisateur.create({
            data: {
                telephone: dto.telephone, email: dto.email ?? null,
                motDePasseHash, prenom: dto.prenom, nom: dto.nom,
                role: dto.role, idStructure: admin.idStructure,
                doitChangerMotDePasse: isTemporaire
            }
        });

        if (dto.role === Role.ASC || dto.role === Role.ASC_SUPERVISOR) {
            await tx.ascProfile.create({ data: { idUtilisateur: u.id, idStructure: admin.idStructure } });
        }
        if (dto.role === Role.MEDECIN) {
            await tx.medecinProfile.create({ data: { idUtilisateur: u.id, idStructure: admin.idStructure } });
        }
        if (dto.role === Role.PHARMACIEN) {
            await tx.pharmacienProfile.create({ data: { idUtilisateur: u.id, idStructure: admin.idStructure } });
        }

        return u;
    });

    // ── Envoi email si adresse disponible ────────────────────────────
    if (dto.email && isTemporaire) {
        try {
            await envoyerEmailAgent({
                destinataire: dto.email,
                prenomNom: `${dto.prenom} ${dto.nom}`,
                role: dto.role,
                nomStructure: admin.structure?.nom ?? 'votre structure',
                telephone: dto.telephone,
                motDePasseTemporaire: motDePasseTemp
            });
        } catch (emailError) {
            console.error('Erreur envoi email agent:', emailError);
        }
    }

    return {
        agent: { id: user.id, telephone: user.telephone, prenom: user.prenom, nom: user.nom, role: user.role },
        motDePasseTemporaire: isTemporaire ? motDePasseTemp : undefined
    };
}

// ── ADMIN_STRUCTURE : désactiver un agent ────────────────────────
export async function desactiverAgent(adminId: string, agentId: string) {
    const admin = await prisma.utilisateur.findUnique({ where: { id: adminId } });
    if (!admin?.idStructure) throw new Error('Aucune structure assignée');

    const agent = await prisma.utilisateur.findUnique({ where: { id: agentId } });
    if (!agent || agent.idStructure !== admin.idStructure) {
        throw new Error('Cet agent n\'appartient pas à votre structure');
    }

    return prisma.utilisateur.update({ where: { id: agentId }, data: { estActif: false } });
}

// ── ADMIN_STRUCTURE : stats de sa structure ──────────────────────
export async function getStatsStructure(adminId: string) {
    const admin = await prisma.utilisateur.findUnique({
        where: { id: adminId }, include: { structure: true }
    });
    if (!admin?.idStructure) throw new Error('Aucune structure assignée');

    const [totalAgents, totalConsultations, totalPatients, structure] = await Promise.all([
        prisma.utilisateur.count({ where: { idStructure: admin.idStructure, estActif: true } }),
        prisma.consultation.count({ where: { asc: { idStructure: admin.idStructure } } }),
        prisma.patientProfile.count({ where: { idStructurePreferee: admin.idStructure } }),
        prisma.structureSante.findUnique({ where: { id: admin.idStructure } })
    ]);

    return { structure, totalAgents, totalConsultations, totalPatients };
}
// src/services/admin-structure.service.ts
import { randomBytes } from 'crypto';
import { prisma } from '../config/prisma';
import { hashPassword } from '../utils/password.utils';
import { Role, TypeStructure } from '../config/generated/client/client';
import { envoyerEmailAdminStructure, envoyerEmailAgent } from './email.service';
import { logger } from '../config/logger';
import type { JwtPayload } from '../types/auth.types';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/app-error';

const ROLES_AUTORISES: Role[] = [Role.ASC, Role.ASC_SUPERVISOR, Role.MEDECIN, Role.PHARMACIEN, Role.AGENT_ACCUEIL, Role.TECHNICIEN_LABO];

// ── Générer un mot de passe temporaire ───────────────────────────
function genererMotDePasseTemp(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    const bytes = randomBytes(5);
    let pwd = 'BaoBao@';
    for (let i = 0; i < 5; i++) {
        pwd += chars[bytes[i] % chars.length];
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
    if (!typeValid) throw new ValidationError(`Type invalide : ${dto.type}`);

    const existingTel = await prisma.utilisateur.findUnique({ where: { telephone: dto.admin.telephone } });
    if (existingTel) throw new ConflictError('Ce numéro de téléphone est déjà utilisé');

    if (dto.admin.email) {
        const existingEmail = await prisma.utilisateur.findUnique({ where: { email: dto.admin.email } });
        if (existingEmail) throw new ConflictError('Cette adresse email est déjà utilisée');
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
            logger.error('Erreur envoi email admin structure', { error: emailError });
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

export async function creerPharmacieAvecPharmacien(dto: {
    nom: string; prefecture: string;
    adresse?: string; latitude?: number; longitude?: number; telephone?: string;
    pharmacien: { prenom: string; nom: string; telephone: string; email?: string; motDePasse?: string; };
}) {
    const existingTel = await prisma.utilisateur.findUnique({ where: { telephone: dto.pharmacien.telephone } });
    if (existingTel) throw new ConflictError('Ce numero de telephone est deja utilise');

    if (dto.pharmacien.email) {
        const existingEmail = await prisma.utilisateur.findUnique({ where: { email: dto.pharmacien.email } });
        if (existingEmail) throw new ConflictError('Cette adresse email est deja utilisee');
    }

    const motDePasseTemp = dto.pharmacien.motDePasse || genererMotDePasseTemp();
    const motDePasseHash = await hashPassword(motDePasseTemp);
    const isTemporaire = !dto.pharmacien.motDePasse;

    const result = await prisma.$transaction(async (tx) => {
        const structure = await tx.structureSante.create({
            data: {
                nom: dto.nom,
                type: TypeStructure.PHARMACIE,
                prefecture: dto.prefecture,
                adresse: dto.adresse,
                latitude: dto.latitude,
                longitude: dto.longitude,
                telephone: dto.telephone,
                estActive: true
            }
        });

        const pharmacien = await tx.utilisateur.create({
            data: {
                telephone: dto.pharmacien.telephone,
                email: dto.pharmacien.email ?? null,
                motDePasseHash,
                prenom: dto.pharmacien.prenom,
                nom: dto.pharmacien.nom,
                role: Role.PHARMACIEN,
                idStructure: structure.id,
                doitChangerMotDePasse: isTemporaire
            }
        });

        await tx.pharmacienProfile.create({
            data: {
                idUtilisateur: pharmacien.id,
                idStructure: structure.id,
                estResponsable: true
            }
        });

        return { structure, pharmacien };
    });

    if (dto.pharmacien.email && isTemporaire) {
        try {
            await envoyerEmailAgent({
                destinataire: dto.pharmacien.email,
                prenomNom: `${dto.pharmacien.prenom} ${dto.pharmacien.nom}`,
                role: Role.PHARMACIEN,
                nomStructure: dto.nom,
                telephone: dto.pharmacien.telephone,
                motDePasseTemporaire: motDePasseTemp
            });
        } catch (emailError) {
            logger.error('Erreur envoi email pharmacien responsable', { error: emailError });
        }
    }

    return {
        structure: result.structure,
        pharmacien: {
            id: result.pharmacien.id,
            telephone: result.pharmacien.telephone,
            email: result.pharmacien.email,
            prenom: result.pharmacien.prenom,
            nom: result.pharmacien.nom,
            role: result.pharmacien.role
        },
        motDePasseTemporaire: isTemporaire ? motDePasseTemp : undefined
    };
}

// ── SUPER_ADMIN : lister toutes les structures ────────────────────
/**
 * Liste ouverte, servie sans authentification : elle alimente le choix de
 * structure preferee cote patient.
 *
 * Deux raisons de ne pas reutiliser getStructures() :
 *  - elle renvoie aussi les structures desactivees, que le patient pouvait
 *    donc selectionner avant de se voir refuser par l'API ;
 *  - elle joint le nom et le telephone de l'administrateur de chaque
 *    structure, qui n'ont rien a faire sur un endpoint public.
 */
export async function getStructuresPubliques() {
    return prisma.structureSante.findMany({
        where: { estActive: true },
        orderBy: { nom: 'asc' },
        select: {
            id: true,
            nom: true,
            type: true,
            prefecture: true,
            adresse: true,
            telephone: true,
        },
    });
}

// ── SUPER_ADMIN : liste complete, structures desactivees comprises ────
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
        if (!typeValid) throw new ValidationError(`Type invalide : ${dto.type}`);
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
    if (!admin?.idStructure) throw new ForbiddenError('Aucune structure assignée');

    const agents = await prisma.utilisateur.findMany({
        where: { idStructure: admin.idStructure, role: { in: ROLES_AUTORISES }, estActif: true },
        select: {
            id: true, telephone: true, email: true, prenom: true, nom: true, role: true,
            creeLe: true, derniereConnexion: true,
            // Le bureau n'existe que pour un medecin, et il est souvent nul.
            medecinProfile: { select: { bureau: true } },
        },
        orderBy: { creeLe: 'desc' }
    });

    return agents.map(({ medecinProfile, ...a }) => ({
        ...a,
        bureau: medecinProfile?.bureau ?? null,
    }));
}

// ── ADMIN_STRUCTURE : créer un agent avec MDP temporaire ─────────
export async function creerAgent(adminId: string, dto: {
    telephone: string; email?: string; motDePasse?: string;
    prenom: string; nom: string; role: Role;
    /** Facultatif, et seulement pour un medecin. */
    bureau?: string;
}) {
    const admin = await prisma.utilisateur.findUnique({
        where: { id: adminId },
        include: { structure: true }
    });
    if (!admin?.idStructure) throw new ForbiddenError('Aucune structure assignée');

    if (!ROLES_AUTORISES.includes(dto.role)) {
        throw new ForbiddenError(`Vous ne pouvez pas créer un compte de type ${dto.role}`);
    }

    const existingTel = await prisma.utilisateur.findUnique({ where: { telephone: dto.telephone } });
    if (existingTel) throw new ConflictError('Ce numéro de téléphone est déjà utilisé');

    if (dto.email) {
        const existingEmail = await prisma.utilisateur.findUnique({ where: { email: dto.email } });
        if (existingEmail) throw new ConflictError('Cette adresse email est déjà utilisée');
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
            await tx.medecinProfile.create({
                data: {
                    idUtilisateur: u.id,
                    idStructure: admin.idStructure,
                    // Facultatif : sans numerotation de bureaux, l'agent accompagne.
                    bureau: dto.bureau?.trim() || null,
                },
            });
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
            logger.error('Erreur envoi email agent', { error: emailError });
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
    if (!admin?.idStructure) throw new ForbiddenError('Aucune structure assignée');

    const agent = await prisma.utilisateur.findUnique({ where: { id: agentId } });
    if (!agent || agent.idStructure !== admin.idStructure) {
        throw new ForbiddenError('Cet agent n\'appartient pas à votre structure');
    }

    return prisma.utilisateur.update({ where: { id: agentId }, data: { estActif: false } });
}

// ── ADMIN_STRUCTURE : stats de sa structure ──────────────────────
export async function getStatsStructure(adminId: string) {
    const admin = await prisma.utilisateur.findUnique({
        where: { id: adminId }, include: { structure: true }
    });
    if (!admin?.idStructure) throw new ForbiddenError('Aucune structure assignée');

    const [totalAgents, totalConsultations, totalPatients, structure] = await Promise.all([
        // Meme filtre que la liste "Mes agents" : l'admin de structure n'est
        // pas un agent, le compteur affichait un de plus que la liste.
        prisma.utilisateur.count({ where: { idStructure: admin.idStructure, role: { in: ROLES_AUTORISES }, estActif: true } }),
        prisma.consultation.count({ where: { asc: { idStructure: admin.idStructure } } }),
        prisma.patientProfile.count({ where: { idStructurePreferee: admin.idStructure } }),
        prisma.structureSante.findUnique({ where: { id: admin.idStructure } })
    ]);

    return { structure, totalAgents, totalConsultations, totalPatients };
}

/**
 * Definir — ou effacer — le bureau d'un medecin (EF-03).
 *
 * **Un bureau change** : un medecin demenage, un service est redecoupe.
 * Figer la valeur a la creation du compte aurait rendu le champ faux au bout
 * de quelques mois, et un bureau faux est pire que pas de bureau : le patient
 * y va.
 *
 * `null` efface : c'est le cas de l'hopital qui ne numerote pas ses bureaux et
 * ou l'agent accompagne le patient a pied.
 */
export async function definirBureau(
    auteur: JwtPayload,
    idAgent: string,
    bureau: string | null,
): Promise<{ id: string; nomComplet: string; bureau: string | null }> {
    const admin = await prisma.utilisateur.findUnique({
        where: { id: auteur.userId },
        select: { idStructure: true },
    });
    if (!admin?.idStructure) throw new ForbiddenError('Aucune structure rattachee a ce compte');

    // Un administrateur ne touche qu'aux medecins de sa structure.
    //
    // **L'appartenance se lit sur le compte, pas sur le profil.** Les deux
    // portent un `idStructure`, et ils divergent : `creerAgent` renseigne les
    // deux, mais tout ce qui cree un medecin autrement — le jeu de
    // demonstration, les jeux de test — ne remplit que le compte. La liste des
    // agents, l'orientation et `structureDe()` lisent tous le compte ; se
    // fonder sur le profil faisait echouer le garde sur des medecins
    // parfaitement legitimes.
    const medecin = await prisma.utilisateur.findFirst({
        where: { id: idAgent, role: Role.MEDECIN, idStructure: admin.idStructure },
        select: { prenom: true, nom: true, medecinProfile: { select: { id: true } } },
    });
    if (!medecin) throw new NotFoundError('Medecin introuvable dans cette structure');

    // Un medecin sans profil n'a nulle part ou poser son bureau. Le cas
    // n'arrive que sur des comptes anciens, et le signaler vaut mieux que de
    // laisser l'agent cliquer sans effet.
    const profil = medecin.medecinProfile;
    if (!profil) throw new NotFoundError('Ce compte medecin n a pas de profil ou enregistrer un bureau');

    const valeur = bureau?.trim() || null;
    await prisma.medecinProfile.update({ where: { id: profil.id }, data: { bureau: valeur } });

    return {
        id: idAgent,
        nomComplet: `${medecin.prenom} ${medecin.nom}`,
        bureau: valeur,
    };
}

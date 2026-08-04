import { prisma } from '../config/prisma';
import {
    ValiderConsultationDto,
    RepondreReferencementDto,
    MedecinFilters,
    SendMessageDto,
} from '../types/medecin.types';
import { JwtPayload } from '../types/auth.types';
import { assertCanAccessConsultation } from './access-control.service';
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/app-error';
import { withCache, cacheDel } from '../utils/cache';
import { emitToUser } from '../realtime/socket.server';

const ADMIN_ROLES = new Set(['ADMIN_REGIONAL', 'ADMIN_NATIONAL', 'SUPER_ADMIN']);

// ─── Récupérer le profil du médecin connecté ─────────────
export async function getMyMedecinProfile(userId: string) {
    const medecin = await prisma.utilisateur.findUnique({
        where: { id: userId },
        select: {
            id: true,
            telephone: true,
            email: true,
            prenom: true,
            nom: true,
            photoUrl: true,
            langue: true,
            role: true,
            structure: true,
            creeLe: true,
        },
    });

    if (!medecin) {
        throw new NotFoundError('Médecin non trouvé');
    }

    return medecin;
}

// ─── Consultations à valider par le médecin ───────────────
export async function getConsultationsAValider(
    userId: string,
    filters: MedecinFilters
) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = {
        statut: 'TERMINEE' as const,
        idMedecinValideur: null,
        ...(filters.prefecture && {
            patient: { prefecture: filters.prefecture },
        }),
    };

    const [consultations, total] = await Promise.all([
        prisma.consultation.findMany({
            where,
            skip,
            take: limit,
            include: {
                patient: {
                    include: {
                        utilisateur: {
                            select: { prenom: true, nom: true, telephone: true },
                        },
                    },
                },
                asc: {
                    include: {
                        utilisateur: {
                            select: { prenom: true, nom: true },
                        },
                    },
                },
                constantes: true,
                diagnostics: true,
                ordonnances: {
                    include: { medicament: true },
                },
            },
            orderBy: { consulteeLE: 'desc' },
        }),
        prisma.consultation.count({ where }),
    ]);

    return {
        data: consultations,
        meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        },
    };
}

// ─── Valider une consultation ─────────────────────────────
export async function validerConsultation(
    user: JwtPayload,
    idConsultation: string,
    dto: ValiderConsultationDto
) {
    await assertCanAccessConsultation(user, idConsultation);

    const consultation = await prisma.consultation.findUnique({
        where: { id: idConsultation },
        include: { ordonnances: true },
    });

    if (!consultation) {
        throw new NotFoundError('Consultation non trouvée');
    }

    if (consultation.idMedecinValideur) {
        throw new ValidationError('Consultation déjà validée par un médecin');
    }

    return prisma.$transaction(async (tx) => {
        const updated = await tx.consultation.update({
            where: { id: idConsultation },
            data: {
                idMedecinValideur: user.userId,
                notesMedecin: dto.notesMedecin,
                signeLe: new Date(),
            },
        });

        if (dto.idOrdonnances && dto.idOrdonnances.length > 0) {
            await tx.ordonnance.updateMany({
                where: {
                    id: { in: dto.idOrdonnances },
                    idConsultation,
                },
                data: {
                    signePar: user.userId,
                    signeLe: new Date(),
                },
            });
        }

        await cacheDel(`medecin:dashboard:${user.userId}`);
        return updated;
    });
}

// ─── Référencements à traiter ─────────────────────────────
export async function getReferencements(
    userId: string,
    filters: MedecinFilters
) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    const medecin = await prisma.utilisateur.findUnique({
        where: { id: userId },
        include: { structure: true },
    });

    const where = {
        ...(filters.statut
            ? { statut: filters.statut }
            : { statut: 'EN_ATTENTE' as const }),
        ...(medecin?.idStructure && {
            idStructureCible: medecin.idStructure,
        }),
    };

    const [referencements, total] = await Promise.all([
        prisma.referencement.findMany({
            where,
            skip,
            take: limit,
            include: {
                consultation: {
                    include: {
                        patient: {
                            include: {
                                utilisateur: {
                                    select: { prenom: true, nom: true, telephone: true },
                                },
                            },
                        },
                        constantes: true,
                        diagnostics: true,
                    },
                },
                structureSource: true,
                structureCible: true,
            },
            orderBy: { creeLe: 'desc' },
        }),
        prisma.referencement.count({ where }),
    ]);

    return {
        data: referencements,
        meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        },
    };
}

// ─── Répondre à un référencement ──────────────────────────
export async function repondreReferencement(
    user: JwtPayload,
    idReferencement: string,
    dto: RepondreReferencementDto
) {
    const referencement = await prisma.referencement.findUnique({
        where: { id: idReferencement },
    });

    if (!referencement) {
        throw new NotFoundError('Référencement non trouvé');
    }

    if (referencement.statut !== 'EN_ATTENTE') {
        throw new ValidationError('Ce référencement a déjà été traité');
    }

    if (dto.statut === 'REFUSE' && !dto.motifRefus) {
        throw new ValidationError('Le motif de refus est obligatoire');
    }

    if (!ADMIN_ROLES.has(user.role)) {
        const utilisateur = await prisma.utilisateur.findUnique({
            where: { id: user.userId },
            select: { idStructure: true },
        });
        if (!utilisateur?.idStructure || utilisateur.idStructure !== referencement.idStructureCible) {
            throw new ForbiddenError('Vous ne pouvez traiter que les référencements dirigés vers votre structure');
        }
    }

    return prisma.referencement.update({
        where: { id: idReferencement },
        data: {
            statut: dto.statut,
            motifRefus: dto.motifRefus,
            idMedecinValideur: user.userId,
            reponduLe: new Date(),
        },
        include: {
            consultation: {
                include: {
                    patient: {
                        include: {
                            utilisateur: {
                                select: { prenom: true, nom: true },
                            },
                        },
                    },
                },
            },
            structureCible: true,
        },
    });
}

// ─── Messagerie — envoyer un message ─────────────────────
export async function sendMessage(userId: string, dto: SendMessageDto) {
    const destinataire = await prisma.utilisateur.findUnique({
        where: { id: dto.idDestinataire },
    });

    if (!destinataire) {
        throw new NotFoundError('Destinataire non trouvé');
    }

    const message = await prisma.message.create({
        data: {
            idExpediteur: userId,
            idDestinataire: dto.idDestinataire,
            contenu: dto.contenu,
            ...(dto.idConsultation && { idConsultation: dto.idConsultation }),
        },
        include: {
            expediteur: {
                select: { prenom: true, nom: true, photoUrl: true },
            },
            destinataire: {
                select: { prenom: true, nom: true, photoUrl: true },
            },
        },
    });

    emitToUser(dto.idDestinataire, 'message:new', message);

    return message;
}

// ─── Messagerie — récupérer les messages ─────────────────
export async function getMessages(userId: string) {
    const messages = await prisma.message.findMany({
        where: {
            OR: [
                { idExpediteur: userId },
                { idDestinataire: userId },
            ],
        },
        include: {
            expediteur: {
                select: { prenom: true, nom: true, photoUrl: true, role: true },
            },
            destinataire: {
                select: { prenom: true, nom: true, photoUrl: true, role: true },
            },
        },
        orderBy: { envoyeLe: 'desc' },
    });

    await prisma.message.updateMany({
        where: {
            idDestinataire: userId,
            lu: false,
        },
        data: { lu: true, luLe: new Date() },
    });

    return messages;
}

// ─── Dashboard médecin — statistiques globales ────────────
export async function getDashboardStats(userId: string) {
    return withCache(`medecin:dashboard:${userId}`, 60, () => _getDashboardStats(userId));
}

async function _getDashboardStats(userId: string) {
    const medecin = await prisma.utilisateur.findUnique({
        where: { id: userId },
        include: { structure: true },
    });

    const [
        consultationsValidees,
        consultationsEnAttente,
        referencementsEnAttente,
        messagesNonLus,
    ] = await Promise.all([
        prisma.consultation.count({
            where: { idMedecinValideur: userId },
        }),
        prisma.consultation.count({
            where: {
                statut: 'TERMINEE',
                idMedecinValideur: null,
                ...(medecin?.idStructure && {
                    asc: { idStructure: medecin.idStructure },
                }),
            },
        }),
        prisma.referencement.count({
            where: {
                statut: 'EN_ATTENTE',
                ...(medecin?.idStructure && {
                    idStructureCible: medecin.idStructure,
                }),
            },
        }),
        prisma.message.count({
            where: {
                idDestinataire: userId,
                lu: false,
            },
        }),
    ]);

    return {
        consultationsValidees,
        consultationsEnAttente,
        referencementsEnAttente,
        messagesNonLus,
        structure: medecin?.structure ?? null,
    };
}

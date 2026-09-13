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
import { notifierSansBloquer } from './notification.service';

const ADMIN_ROLES = new Set(['ADMIN_REGIONAL', 'ADMIN_NATIONAL', 'SUPER_ADMIN']);

// Route web ou un clic sur la notification renvoie, selon l'espace du destinataire.
function lienEspace(role: string, sousChemin: string): string {
    const espaces: Record<string, string> = {
        PATIENT: '/patient',
        ASC: '/asc',
        ASC_SUPERVISOR: '/asc',
        MEDECIN: '/medecin',
        PHARMACIEN: '/pharmacien',
    };
    return `${espaces[role] ?? '/'}${sousChemin}`;
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
        include: {
            ordonnances: true,
            patient: { select: { idUtilisateur: true } },
        },
    });

    if (!consultation) {
        throw new NotFoundError('Consultation non trouvée');
    }

    if (consultation.idMedecinValideur) {
        throw new ValidationError('Consultation déjà validée par un médecin');
    }

    const idOrdonnancesSignees = dto.idOrdonnances ?? [];

    const updated = await prisma.$transaction(async (tx) => {
        const updated = await tx.consultation.update({
            where: { id: idConsultation },
            data: {
                idMedecinValideur: user.userId,
                notesMedecin: dto.notesMedecin,
                signeLe: new Date(),
            },
        });

        if (idOrdonnancesSignees.length > 0) {
            await tx.ordonnance.updateMany({
                where: {
                    id: { in: idOrdonnancesSignees },
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

    // Apres la transaction : la notification ne doit pas pouvoir l'annuler.
    if (idOrdonnancesSignees.length > 0) {
        await notifierSansBloquer({
            idUtilisateur: consultation.patient.idUtilisateur,
            type: 'ORDONNANCE_SIGNEE',
            titre: 'Ordonnance signée par le médecin',
            contenu: 'Votre ordonnance est prête : présentez votre QR code en pharmacie.',
            lienAction: '/patient/qr-code',
            metadonnees: { idConsultation, idOrdonnances: idOrdonnancesSignees },
        });
    }

    return updated;
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

    const referencementTraite = await prisma.referencement.update({
        where: { id: idReferencement },
        data: {
            statut: dto.statut,
            motifRefus: dto.motifRefus,
            idMedecinValideur: user.userId,
            reponduLe: new Date(),
        },
        // Meme forme que getReferencements (ReferencementATraiterView) : la page
        // remplace la ligne traitee par la reponse sans recharger la liste.
        include: {
            consultation: {
                include: {
                    patient: {
                        include: {
                            utilisateur: {
                                select: { id: true, prenom: true, nom: true, telephone: true },
                            },
                        },
                    },
                    constantes: true,
                    diagnostics: true,
                    asc: { select: { idUtilisateur: true } },
                },
            },
            structureSource: true,
            structureCible: true,
        },
    });

    if (dto.statut === 'ACCEPTE' || dto.statut === 'REFUSE') {
        const { consultation, structureCible } = referencementTraite;
        const accepte = dto.statut === 'ACCEPTE';
        const type = accepte ? 'REFERENCEMENT_ACCEPTE' : 'REFERENCEMENT_REFUSE';
        const titre = accepte
            ? `Transfert vers ${structureCible.nom} accepté`
            : `Transfert vers ${structureCible.nom} refusé`;

        // Le patient et l'ASC qui a initie le referencement sont prevenus.
        await notifierSansBloquer({
            idUtilisateur: consultation.patient.utilisateur.id,
            type,
            titre,
            contenu: accepte
                ? 'Présentez-vous à la structure avec votre QR code.'
                : `Motif : ${dto.motifRefus}. Contactez votre ASC pour la suite.`,
            lienAction: '/patient/dashboard',
            metadonnees: { idReferencement, idConsultation: consultation.id },
        });

        if (consultation.asc) {
            await notifierSansBloquer({
                idUtilisateur: consultation.asc.idUtilisateur,
                type,
                titre,
                contenu: accepte
                    ? `Patient ${consultation.patient.utilisateur.prenom} ${consultation.patient.utilisateur.nom} attendu à ${structureCible.nom}.`
                    : `Motif : ${dto.motifRefus}`,
                lienAction: `/asc/consultations/${consultation.id}`,
                metadonnees: { idReferencement, idConsultation: consultation.id },
            });
        }
    }

    return referencementTraite;
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

    // Le destinataire peut ne pas etre sur la page messagerie : la cloche
    // prend le relais de l'evenement message:new.
    await notifierSansBloquer({
        idUtilisateur: dto.idDestinataire,
        type: 'NOUVEAU_MESSAGE',
        titre: `Nouveau message de ${message.expediteur.prenom} ${message.expediteur.nom}`,
        contenu: dto.contenu.length > 120 ? `${dto.contenu.slice(0, 117)}...` : dto.contenu,
        lienAction: destinataire.role === 'MEDECIN' ? '/medecin/messagerie' : undefined,
        metadonnees: { idMessage: message.id, idExpediteur: userId },
    });

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

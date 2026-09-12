import { randomBytes } from 'crypto';
import { Prisma } from '../config/generated/client/client';
import { prisma } from '../config/prisma';
import { logger } from '../config/logger';
import { NotFoundError, ValidationError } from '../utils/app-error';
import { emitToUser } from '../realtime/socket.server';
import {
    SendSmsDto,
    SendNotificationDto,
    NotificationFilters,
    TypeNotification,
} from '../types/notification.types';
import type { NotificationView, PaginatedData } from '@baobaoheath/shared-types';

// ─── Notifications in-app ──────────────────────────────────
// Persistees en base (table notifications) et poussees en temps reel sur la
// room Socket.IO de l'utilisateur (evenement `notification:new`). La cloche
// des layouts web lit la liste au chargement puis ecoute l'evenement.

export interface CreerNotificationDto {
    idUtilisateur: string;
    type: TypeNotification;
    titre: string;
    contenu: string;
    /** Route web vers laquelle un clic sur la notification renvoie. */
    lienAction?: string;
    metadonnees?: Record<string, unknown>;
}

const NOTIFICATION_SELECT = {
    id: true,
    type: true,
    titre: true,
    contenu: true,
    lienAction: true,
    metadonnees: true,
    luLe: true,
    creeLe: true,
} as const;

function versVue(n: {
    id: string; type: TypeNotification; titre: string; contenu: string;
    lienAction: string | null; metadonnees: unknown; luLe: Date | null; creeLe: Date;
}): NotificationView {
    return {
        ...n,
        metadonnees: (n.metadonnees ?? null) as NotificationView['metadonnees'],
    };
}

export async function creerNotification(dto: CreerNotificationDto): Promise<NotificationView> {
    const notification = await prisma.notification.create({
        data: {
            idUtilisateur: dto.idUtilisateur,
            type: dto.type,
            titre: dto.titre,
            contenu: dto.contenu,
            lienAction: dto.lienAction,
            metadonnees: dto.metadonnees as Prisma.InputJsonValue | undefined,
        },
        select: NOTIFICATION_SELECT,
    });

    const vue = versVue(notification);
    emitToUser(dto.idUtilisateur, 'notification:new', vue);
    return vue;
}

/**
 * Variante « best effort » pour les points d'accroche metier (message envoye,
 * referencement traite, ordonnance signee...) : l'echec de la notification ne
 * doit jamais faire echouer l'operation qui la declenche.
 */
export async function notifierSansBloquer(dto: CreerNotificationDto): Promise<void> {
    try {
        await creerNotification(dto);
    } catch (e: unknown) {
        logger.warn('[NOTIF] creation in-app echouee', {
            type: dto.type,
            idUtilisateur: dto.idUtilisateur,
            erreur: e instanceof Error ? e.message : String(e),
        });
    }
}

export async function getMesNotifications(
    userId: string,
    filters: NotificationFilters,
): Promise<PaginatedData<NotificationView>> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const where = {
        idUtilisateur: userId,
        ...(filters.lu === true && { luLe: { not: null } }),
        ...(filters.lu === false && { luLe: null }),
        ...(filters.type && { type: filters.type }),
    };

    const [items, total] = await Promise.all([
        prisma.notification.findMany({
            where,
            select: NOTIFICATION_SELECT,
            orderBy: { creeLe: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.notification.count({ where }),
    ]);

    return {
        items: items.map(versVue),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
    };
}

export async function compterNonLues(userId: string): Promise<number> {
    return prisma.notification.count({ where: { idUtilisateur: userId, luLe: null } });
}

export async function marquerLue(userId: string, id: string): Promise<NotificationView> {
    // Filtre sur idUtilisateur : un utilisateur ne peut pas marquer la
    // notification d'un autre (404 plutot que 403, l'existence n'est pas revelee).
    const existante = await prisma.notification.findFirst({
        where: { id, idUtilisateur: userId },
        select: { id: true, luLe: true },
    });
    if (!existante) throw new NotFoundError('Notification non trouvée');

    const notification = await prisma.notification.update({
        where: { id },
        data: { luLe: existante.luLe ?? new Date() },
        select: NOTIFICATION_SELECT,
    });
    return versVue(notification);
}

export async function toutMarquerLu(userId: string): Promise<number> {
    const { count } = await prisma.notification.updateMany({
        where: { idUtilisateur: userId, luLe: null },
        data: { luLe: new Date() },
    });
    return count;
}

// ─── MOCK — Simuler envoi SMS Africa's Talking ───────────
async function mockSendSms(
    telephone: string,
    message: string
): Promise<{ messageId: string; statut: string }> {
    await new Promise((r) => setTimeout(r, 300));
    logger.debug(`[SMS MOCK] -> ${telephone}: ${message}`);
    return {
        messageId: `AT-${Date.now()}-${randomBytes(2).readUInt16BE(0)}`,
        statut: 'ENVOYE',
    };
}

// ─── Envoyer un SMS ───────────────────────────────────────
export async function envoyerSms(dto: SendSmsDto) {
    const result = await mockSendSms(dto.telephone, dto.message);
    return result;
}

// ─── Envoyer rappel de rendez-vous ───────────────────────
export async function envoyerRappelRendezVous(idRendezVous: string) {
    const rdv = await prisma.rendezVous.findUnique({
        where: { id: idRendezVous },
        include: {
            patient: {
                include: {
                    utilisateur: {
                        select: { prenom: true, nom: true, telephone: true },
                    },
                },
            },
        },
    });

    if (!rdv) {
        throw new NotFoundError('Rendez-vous non trouvé');
    }

    const { utilisateur } = rdv.patient;
    const dateFormatee = rdv.prevuLe.toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
    });

    const message = `BaoBaoHealth: Bonjour ${utilisateur.prenom}, rappel de votre rendez-vous le ${dateFormatee}. Répondez STOP pour annuler.`;

    const result = await mockSendSms(utilisateur.telephone, message);

    await prisma.rendezVous.update({
        where: { id: idRendezVous },
        data: { rappel24h: true },
    });

    return result;
}

// ─── Envoyer alerte stock critique ───────────────────────
export async function envoyerAlerteStock(idStock: string) {
    const stock = await prisma.stock.findUnique({
        where: { id: idStock },
        include: {
            medicament: true,
            asc: {
                include: {
                    utilisateur: {
                        select: { prenom: true, telephone: true },
                    },
                },
            },
        },
    });

    if (!stock) {
        throw new NotFoundError('Stock non trouvé');
    }

    const message = `BaoBaoHealth ALERTE: Stock critique — ${stock.medicament.dci} (${stock.quantite} ${stock.unite} restants, seuil: ${stock.seuilAlerte}). Veuillez renouveler votre stock.`;

    if (!stock.asc) {
        throw new ValidationError('Ce stock n est pas rattache a un ASC');
    }

    return mockSendSms(stock.asc.utilisateur.telephone, message);
}

// ─── Envoyer notification de référencement ────────────────
export async function envoyerNotificationReferencement(
    idReferencement: string,
    statut: 'ACCEPTE' | 'REFUSE'
) {
    const ref = await prisma.referencement.findUnique({
        where: { id: idReferencement },
        include: {
            consultation: {
                include: {
                    patient: {
                        include: {
                            utilisateur: {
                                select: { prenom: true, telephone: true },
                            },
                        },
                    },
                },
            },
            structureCible: true,
        },
    });

    if (!ref) {
        throw new NotFoundError('Référencement non trouvé');
    }

    const { utilisateur } = ref.consultation.patient;
    const structure = ref.structureCible.nom;

    const message =
        statut === 'ACCEPTE'
            ? `BaoBaoHealth: Bonjour ${utilisateur.prenom}, votre transfert vers ${structure} a été ACCEPTÉ. Présentez-vous avec votre QR Code.`
            : `BaoBaoHealth: Bonjour ${utilisateur.prenom}, votre transfert vers ${structure} a été refusé. Contactez votre ASC pour plus d'informations.`;

    return mockSendSms(utilisateur.telephone, message);
}

// ─── Envoyer rappel de vaccination ───────────────────────
export async function envoyerRappelVaccination(idVaccination: string) {
    const vaccination = await prisma.vaccination.findUnique({
        where: { id: idVaccination },
        include: {
            patient: {
                include: {
                    utilisateur: {
                        select: { prenom: true, telephone: true },
                    },
                },
            },
        },
    });

    if (!vaccination) {
        throw new NotFoundError('Vaccination non trouvée');
    }

    const { utilisateur } = vaccination.patient;
    const dateFormatee = vaccination.dateProchaineD?.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });

    const message = `BaoBaoHealth: Bonjour ${utilisateur.prenom}, rappel — votre vaccination ${vaccination.vaccinNom} est due le ${dateFormatee}. Contactez votre ASC.`;

    return mockSendSms(utilisateur.telephone, message);
}

// ─── Envoyer SMS personnalisé (Admin) ─────────────────────
export async function envoyerSmsMasse(
    prefecture: string,
    message: string
) {
    const patients = await prisma.patientProfile.findMany({
        where: { prefecture },
        include: {
            utilisateur: {
                select: { telephone: true, prenom: true },
            },
        },
    });

    const resultats = await Promise.allSettled(
        patients.map((p) =>
            mockSendSms(p.utilisateur.telephone, message)
        )
    );

    const envoyes = resultats.filter((r) => r.status === 'fulfilled').length;
    const echoues = resultats.filter((r) => r.status === 'rejected').length;

    return {
        total: patients.length,
        envoyes,
        echoues,
        prefecture,
    };
}

// ─── Vérifier les rappels à envoyer (CRON) ───────────────
export async function verifierRappelsAEnvoyer() {
    const demain = new Date();
    demain.setDate(demain.getDate() + 1);
    demain.setHours(0, 0, 0, 0);

    const apresdemain = new Date();
    apresdemain.setDate(apresdemain.getDate() + 2);
    apresdemain.setHours(0, 0, 0, 0);

    // Rendez-vous demain non rappelés
    const rdvsARappeler = await prisma.rendezVous.findMany({
        where: {
            prevuLe: { gte: demain, lt: apresdemain },
            rappel24h: false,
            statut: 'PLANIFIE',
        },
        select: { id: true },
    });

    // Vaccinations dues dans 7 jours
    const dansSetJours = new Date();
    dansSetJours.setDate(dansSetJours.getDate() + 7);

    const vaccinationsARappeler = await prisma.vaccination.findMany({
        where: {
            dateProchaineD: {
                gte: new Date(),
                lte: dansSetJours,
            },
        },
        select: { id: true },
    });

    return {
        rendezVousARappeler: rdvsARappeler.length,
        vaccinationsARappeler: vaccinationsARappeler.length,
        ids: {
            rendezVous: rdvsARappeler.map((r) => r.id),
            vaccinations: vaccinationsARappeler.map((v) => v.id),
        },
    };
}

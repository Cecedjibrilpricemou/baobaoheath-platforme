import { randomBytes } from 'crypto';
import { prisma } from '../config/prisma';
import { logger } from '../config/logger';
import {
    SendSmsDto,
    SendNotificationDto,
    NotificationFilters,
    TypeNotification,
} from '../types/notification.types';

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
        throw new Error('Rendez-vous non trouvé');
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
        throw new Error('Stock non trouvé');
    }

    const message = `BaoBaoHealth ALERTE: Stock critique — ${stock.medicament.dci} (${stock.quantite} ${stock.unite} restants, seuil: ${stock.seuilAlerte}). Veuillez renouveler votre stock.`;

    if (!stock.asc) {
        throw new Error('Ce stock n est pas rattache a un ASC');
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
        throw new Error('Référencement non trouvé');
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
        throw new Error('Vaccination non trouvée');
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

import { prisma } from '../config/prisma';
import {
    UpdateAscProfileDto,
    CreateStockDto,
    UpdateStockDto,
    StockFilters,
    RapportFilters,
} from '../types/asc.types';
import { ConflictError, ForbiddenError, NotFoundError } from '../utils/app-error';

// ─── Récupérer le profil ASC connecté ────────────────────
export async function getMyAscProfile(userId: string) {
    const asc = await prisma.ascProfile.findUnique({
        where: { idUtilisateur: userId },
        include: {
            utilisateur: {
                select: {
                    id: true,
                    telephone: true,
                    email: true,
                    prenom: true,
                    nom: true,
                    photoUrl: true,
                    langue: true,
                },
            },
            structure: true,
            superviseur: {
                include: {
                    utilisateur: {
                        select: { prenom: true, nom: true, telephone: true },
                    },
                },
            },
        },
    });

    if (!asc) {
        throw new NotFoundError('Profil ASC non trouvé');
    }

    return asc;
}

// ─── Mettre à jour le profil ASC ─────────────────────────
export async function updateAscProfile(
    userId: string,
    dto: UpdateAscProfileDto
) {
    const asc = await prisma.ascProfile.findUnique({
        where: { idUtilisateur: userId },
    });

    if (!asc) {
        throw new NotFoundError('Profil ASC non trouvé');
    }

    if (dto.photoUrl) {
        await prisma.utilisateur.update({
            where: { id: userId },
            data: { photoUrl: dto.photoUrl },
        });
    }

    return prisma.ascProfile.update({
        where: { idUtilisateur: userId },
        data: {
            ...(dto.numeroCertification && {
                numeroCertification: dto.numeroCertification,
            }),
            ...(dto.zoneCouverture && { zoneCouverture: dto.zoneCouverture }),
        },
        include: {
            utilisateur: {
                select: {
                    prenom: true,
                    nom: true,
                    telephone: true,
                    photoUrl: true,
                },
            },
        },
    });
}

// ─── Récupérer les patients de la zone de l'ASC ──────────
export async function getAscPatients(userId: string) {
    const asc = await prisma.ascProfile.findUnique({
        where: { idUtilisateur: userId },
        include: { consultations: { select: { idPatient: true } } },
    });

    if (!asc) {
        throw new NotFoundError('Profil ASC non trouvé');
    }

    const idPatients = [
        ...new Set(asc.consultations.map((c) => c.idPatient)),
    ];

    const patients = await prisma.patientProfile.findMany({
        where: { id: { in: idPatients } },
        include: {
            utilisateur: {
                select: {
                    prenom: true,
                    nom: true,
                    telephone: true,
                    photoUrl: true,
                },
            },
        },
        orderBy: { creeLe: 'desc' },
    });

    return patients;
}

// ─── Récupérer le planning (rendez-vous) de l'ASC ────────
export async function getAscPlanning(userId: string) {
    const asc = await prisma.ascProfile.findUnique({
        where: { idUtilisateur: userId },
    });

    if (!asc) {
        throw new NotFoundError('Profil ASC non trouvé');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const rendezVous = await prisma.rendezVous.findMany({
        where: {
            idAsc: asc.id,
            prevuLe: { gte: today },
        },
        include: {
            patient: {
                include: {
                    utilisateur: {
                        select: { prenom: true, nom: true, telephone: true },
                    },
                },
            },
        },
        orderBy: { prevuLe: 'asc' },
    });

    return rendezVous;
}

// ─── Récupérer les stocks de l'ASC ───────────────────────
export async function getAscStocks(userId: string, filters: StockFilters) {
    const asc = await prisma.ascProfile.findUnique({
        where: { idUtilisateur: userId },
    });

    if (!asc) {
        throw new NotFoundError('Profil ASC non trouvé');
    }

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = {
        idAsc: asc.id,
        ...(filters.seuilAlerte && {
            quantite: { lte: prisma.stock.fields.seuilAlerte },
        }),
    };

    const [stocks, total] = await Promise.all([
        prisma.stock.findMany({
            where: { idAsc: asc.id },
            skip,
            take: limit,
            include: { medicament: true },
            orderBy: { modifieLe: 'desc' },
        }),
        prisma.stock.count({ where: { idAsc: asc.id } }),
    ]);

    // Identifier les stocks en alerte
    const stocksAvecAlerte = stocks.map((s) => ({
        ...s,
        enAlerte: s.quantite <= s.seuilAlerte,
    }));

    return {
        data: stocksAvecAlerte,
        meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            alertes: stocksAvecAlerte.filter((s) => s.enAlerte).length,
        },
    };
}

// ─── Créer un stock ───────────────────────────────────────
export async function createStock(userId: string, dto: CreateStockDto) {
    const asc = await prisma.ascProfile.findUnique({
        where: { idUtilisateur: userId },
    });

    if (!asc) {
        throw new NotFoundError('Profil ASC non trouvé');
    }

    const medicament = await prisma.medicament.findUnique({
        where: { id: dto.idMedicament },
    });

    if (!medicament) {
        throw new NotFoundError('Médicament non trouvé');
    }

    const existingStock = await prisma.stock.findUnique({
        where: {
            idAsc_idMedicament: {
                idAsc: asc.id,
                idMedicament: dto.idMedicament,
            },
        },
    });

    if (existingStock) {
        throw new ConflictError(
            'Un stock existe déjà pour ce médicament — utilisez la mise à jour'
        );
    }

    return prisma.stock.create({
        data: {
            idAsc: asc.id,
            idMedicament: dto.idMedicament,
            quantite: dto.quantite,
            unite: dto.unite,
            seuilAlerte: dto.seuilAlerte ?? 10,
            datePeremption: dto.datePeremption
                ? new Date(dto.datePeremption)
                : undefined,
        },
        include: { medicament: true },
    });
}

// ─── Mettre à jour un stock ───────────────────────────────
export async function updateStock(
    userId: string,
    stockId: string,
    dto: UpdateStockDto
) {
    const asc = await prisma.ascProfile.findUnique({
        where: { idUtilisateur: userId },
    });

    if (!asc) {
        throw new NotFoundError('Profil ASC non trouvé');
    }

    const stock = await prisma.stock.findUnique({
        where: { id: stockId },
    });

    if (!stock || stock.idAsc !== asc.id) {
        throw new ForbiddenError('Stock non trouvé ou accès refusé');
    }

    return prisma.stock.update({
        where: { id: stockId },
        data: {
            quantite: dto.quantite,
            unite: dto.unite,
            ...(dto.seuilAlerte !== undefined && { seuilAlerte: dto.seuilAlerte }),
            ...(dto.datePeremption && {
                datePeremption: new Date(dto.datePeremption),
            }),
        },
        include: { medicament: true },
    });
}

// ─── Rapport mensuel de l'ASC ─────────────────────────────
export async function getRapportMensuel(
    userId: string,
    filters: RapportFilters
) {
    const asc = await prisma.ascProfile.findUnique({
        where: { idUtilisateur: userId },
    });

    if (!asc) {
        throw new NotFoundError('Profil ASC non trouvé');
    }

    const debut = new Date(filters.annee, filters.mois - 1, 1);
    const fin = new Date(filters.annee, filters.mois, 0, 23, 59, 59);

    const [
        consultations,
        references,
        vaccinations,
        rendezVous,
    ] = await Promise.all([
        prisma.consultation.findMany({
            where: {
                idAsc: asc.id,
                creeLe: { gte: debut, lte: fin },
            },
            include: {
                constantes: true,
                diagnostics: true,
            },
        }),
        prisma.referencement.findMany({
            where: {
                consultation: {
                    idAsc: asc.id,
                    creeLe: { gte: debut, lte: fin },
                },
            },
        }),
        prisma.vaccination.findMany({
            where: {
                administrePar: { ascProfile: { idUtilisateur: userId } },
                administreLe: { gte: debut, lte: fin },
            },
        }),
        prisma.rendezVous.findMany({
            where: {
                idAsc: asc.id,
                prevuLe: { gte: debut, lte: fin },
            },
        }),
    ]);

    // Calcul des statistiques
    const diagnosticsCount: Record<string, number> = {};
    consultations.forEach((c) => {
        c.diagnostics.forEach((d) => {
            diagnosticsCount[d.libelle] = (diagnosticsCount[d.libelle] ?? 0) + 1;
        });
    });

    const topDiagnostics = Object.entries(diagnosticsCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([libelle, count]) => ({ libelle, count }));

    return {
        periode: {
            mois: filters.mois,
            annee: filters.annee,
            debut,
            fin,
        },
        statistiques: {
            totalConsultations: consultations.length,
            consultationsTerminees: consultations.filter(
                (c) => c.statut === 'TERMINEE'
            ).length,
            totalReferences: references.length,
            totalVaccinations: vaccinations.length,
            totalRendezVous: rendezVous.length,
            rendezVousHonores: rendezVous.filter((r) => r.statut === 'HONORE').length,
        },
        topDiagnostics,
        alertesStock: await prisma.stock.count({
            where: {
                idAsc: asc.id,
                quantite: { lte: 10 },
            },
        }),
    };
}
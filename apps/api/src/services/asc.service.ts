import { prisma } from '../config/prisma';
import {
    CreateStockDto,
    UpdateStockDto,
    StockFilters,
    RapportFilters,
} from '../types/asc.types';
import { peremptionLaPlusProche } from './approvisionnement.service';
import { ConflictError, ForbiddenError, NotFoundError } from '../utils/app-error';

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

    // `where` porte le filtre seuilAlerte : les deux requetes doivent l'utiliser,
    // sinon ?seuilAlerte=true renvoie tout le stock.
    const [stocks, total] = await Promise.all([
        prisma.stock.findMany({
            where,
            skip,
            take: limit,
            include: {
                medicament: true,
                // La peremption appartient aux lots depuis le 2026-09-30.
                lots: { select: { quantite: true, datePeremption: true } },
            },
            orderBy: { modifieLe: 'desc' },
        }),
        prisma.stock.count({ where }),
    ]);

    // Identifier les stocks en alerte
    const stocksAvecAlerte = stocks.map(({ lots, ...s }) => ({
        ...s,
        enAlerte: s.quantite <= s.seuilAlerte,
        peremptionLaPlusProche: peremptionLaPlusProche(lots),
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

    // La date de peremption descend dans un lot depuis le 2026-09-30 : une
    // seule date par produit ne tenait pas, un reapprovisionnement en apporte
    // d'autres (addendum, point 1.3).
    return prisma.$transaction(async (tx) => {
        const cree = await tx.stock.create({
            data: {
                idAsc: asc.id,
                idMedicament: dto.idMedicament,
                quantite: dto.quantite,
                unite: dto.unite,
                seuilAlerte: dto.seuilAlerte ?? 10,
            },
            include: { medicament: true },
        });

        if (dto.quantite > 0) {
            await tx.lotStock.create({
                data: {
                    idStock: cree.id,
                    quantite: dto.quantite,
                    quantiteRecue: dto.quantite,
                    datePeremption: dto.datePeremption ? new Date(dto.datePeremption) : null,
                },
            });
        }
        return cree;
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

    return prisma.$transaction(async (tx) => {
        const maj = await tx.stock.update({
            where: { id: stockId },
            data: {
                quantite: dto.quantite,
                unite: dto.unite,
                ...(dto.seuilAlerte !== undefined && { seuilAlerte: dto.seuilAlerte }),
            },
            include: { medicament: true },
        });

        // Une date de peremption donnee ici porte sur le lot en cours : c'est
        // une correction de saisie, pas une nouvelle entree en stock.
        if (dto.datePeremption) {
            const lot = await tx.lotStock.findFirst({
                where: { idStock: stockId },
                orderBy: { creeLe: 'desc' },
            });
            if (lot) {
                await tx.lotStock.update({
                    where: { id: lot.id },
                    data: { datePeremption: new Date(dto.datePeremption) },
                });
            }
        }
        return maj;
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
            // 'HONORE' jusqu'au 2026-09-30 : une valeur que personne n'ecrivait
            // jamais, donc un compteur structurellement a zero. Le statut est
            // desormais une enumeration, et c'est 'TERMINE' qui marque un
            // rendez-vous tenu.
            rendezVousHonores: rendezVous.filter((r) => r.statut === 'TERMINE').length,
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
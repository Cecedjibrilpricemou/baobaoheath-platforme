import { prisma } from '../config/prisma';
import { JwtPayload } from '../types/auth.types';
import {
    CreateVaccinationDto,
    UpdateVaccinationDto,
    VaccinationFilters,
    RappelVaccinationFilters,
} from '../types/vaccination.types';
import { assertCanAccessPatient } from './access-control.service';
import { ForbiddenError } from '../utils/app-error';

// ─── Administrer un vaccin ────────────────────────────────
export async function administrerVaccin(
    user: JwtPayload,
    dto: CreateVaccinationDto
) {
    const patient = await prisma.patientProfile.findUnique({
        where: { id: dto.idPatient },
    });

    if (!patient) {
        throw new Error('Patient non trouvé');
    }

    await assertCanAccessPatient(user, dto.idPatient);

    return prisma.vaccination.create({
        data: {
            idPatient: dto.idPatient,
            idAdministrePar: user.userId,
            vaccinNom: dto.vaccinNom,
            codeEpi: dto.codeEpi,
            numeroLot: dto.numeroLot,
            siteInjection: dto.siteInjection,
            reaction: dto.reaction,
            dateProchaineD: dto.dateProchaineD
                ? new Date(dto.dateProchaineD)
                : undefined,
        },
        include: {
            patient: {
                include: {
                    utilisateur: {
                        select: { prenom: true, nom: true, telephone: true },
                    },
                },
            },
            administrePar: {
                select: { prenom: true, nom: true, role: true },
            },
        },
    });
}

// ─── Récupérer le carnet vaccinal d'un patient ───────────
export async function getCarnetVaccinal(
    user: JwtPayload,
    idPatient: string,
    filters: VaccinationFilters
) {
    const patient = await prisma.patientProfile.findUnique({
        where: { id: idPatient },
    });

    if (!patient) {
        throw new Error('Patient non trouvé');
    }

    await assertCanAccessPatient(user, idPatient);

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 50;
    const skip = (page - 1) * limit;

    const where = {
        idPatient,
        ...(filters.vaccinNom && {
            vaccinNom: { contains: filters.vaccinNom, mode: 'insensitive' as const },
        }),
    };

    const [vaccinations, total] = await Promise.all([
        prisma.vaccination.findMany({
            where,
            skip,
            take: limit,
            include: {
                administrePar: {
                    select: { prenom: true, nom: true, role: true },
                },
            },
            orderBy: { administreLe: 'desc' },
        }),
        prisma.vaccination.count({ where }),
    ]);

    return {
        data: vaccinations,
        meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        },
    };
}

// ─── Mon carnet vaccinal (patient connecté) ───────────────
export async function getMonCarnetVaccinal(userId: string) {
    const patient = await prisma.patientProfile.findUnique({
        where: { idUtilisateur: userId },
    });

    if (!patient) {
        throw new Error('Profil patient non trouvé');
    }

    const vaccinations = await prisma.vaccination.findMany({
        where: { idPatient: patient.id },
        include: {
            administrePar: {
                select: { prenom: true, nom: true, role: true },
            },
        },
        orderBy: { administreLe: 'desc' },
    });

    return vaccinations;
}

// ─── Mettre à jour une vaccination ───────────────────────
export async function updateVaccination(
    user: JwtPayload,
    id: string,
    dto: UpdateVaccinationDto
) {
    const vaccination = await prisma.vaccination.findUnique({
        where: { id },
    });

    if (!vaccination) {
        throw new Error('Vaccination non trouvée');
    }

    await assertCanAccessPatient(user, vaccination.idPatient);

    return prisma.vaccination.update({
        where: { id },
        data: {
            ...(dto.reaction && { reaction: dto.reaction }),
            ...(dto.urlCertificat && { urlCertificat: dto.urlCertificat }),
            ...(dto.dateProchaineD && {
                dateProchaineD: new Date(dto.dateProchaineD),
            }),
        },
        include: {
            patient: {
                include: {
                    utilisateur: {
                        select: { prenom: true, nom: true },
                    },
                },
            },
        },
    });
}

// ─── Rappels de vaccination à venir ──────────────────────
export async function getRappelsVaccination(
    filters: RappelVaccinationFilters
) {
    const joursAvant = filters.joursAvant ?? 7;
    const today = new Date();
    const dateLimite = new Date();
    dateLimite.setDate(today.getDate() + joursAvant);

    const vaccinations = await prisma.vaccination.findMany({
        where: {
            dateProchaineD: {
                gte: today,
                lte: dateLimite,
            },
        },
        include: {
            patient: {
                include: {
                    utilisateur: {
                        select: { prenom: true, nom: true, telephone: true },
                    },
                },
                ...(filters.prefecture && {
                    where: { prefecture: filters.prefecture },
                }),
            },
        },
        orderBy: { dateProchaineD: 'asc' },
    });

    return vaccinations.filter((v) => v.patient !== null);
}

// ─── Statistiques de vaccination par vaccin ───────────────
export async function getStatsVaccination(prefecture?: string) {
    const where = prefecture
        ? { patient: { prefecture } }
        : {};

    const vaccinations = await prisma.vaccination.findMany({
        where,
        select: {
            vaccinNom: true,
            administreLe: true,
            patient: {
                select: { sexe: true, prefecture: true },
            },
        },
    });

    const statsParVaccin: Record<string, number> = {};
    vaccinations.forEach((v) => {
        statsParVaccin[v.vaccinNom] = (statsParVaccin[v.vaccinNom] ?? 0) + 1;
    });

    const topVaccins = Object.entries(statsParVaccin)
        .sort((a, b) => b[1] - a[1])
        .map(([vaccinNom, count]) => ({ vaccinNom, count }));

    return {
        totalAdministrees: vaccinations.length,
        topVaccins,
        parPrefecture: prefecture ?? 'toutes',
    };
}
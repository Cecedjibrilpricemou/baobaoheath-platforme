import { prisma } from '../config/prisma';
import {
  CreateConsultationDto,
  UpdateConsultationDto,
  VitalsDto,
  DiagnosticDto,
  OrdonnanceDto,
  ReferralDto,
  ConsultationFilters,
} from '../types/consultation.types';
import { EncounterStatus } from '../config/generated/client/client';

// ─── Ouvrir une nouvelle consultation ────────────────────
export async function createConsultation(
  dto: CreateConsultationDto,
  idAsc: string
) {
  // Vérifier que le patient existe
  const patient = await prisma.patientProfile.findUnique({
    where: { id: dto.idPatient },
  });

  if (!patient) {
    throw new Error('Patient non trouvé');
  }

  const consultation = await prisma.consultation.create({
    data: {
      idPatient: dto.idPatient,
      idAsc,
      motifPrincipal: dto.motifPrincipal,
      symptomes: dto.symptomes ?? [],
      statut: EncounterStatus.EN_COURS,
    },
    include: {
      patient: {
        include: {
          utilisateur: {
            select: {
              prenom: true,
              nom: true,
              telephone: true,
            },
          },
        },
      },
    },
  });

  return consultation;
}

// ─── Récupérer une consultation par ID ───────────────────
export async function getConsultationById(id: string) {
  const consultation = await prisma.consultation.findUnique({
    where: { id },
    include: {
      patient: {
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
      referencement: true,
      facture: true,
    },
  });

  if (!consultation) {
    throw new Error('Consultation non trouvée');
  }

  return consultation;
}

// ─── Mettre à jour une consultation ──────────────────────
export async function updateConsultation(
  id: string,
  dto: UpdateConsultationDto
) {
  const consultation = await prisma.consultation.findUnique({
    where: { id },
  });

  if (!consultation) {
    throw new Error('Consultation non trouvée');
  }

  if (consultation.statut === EncounterStatus.TERMINEE) {
    throw new Error('Impossible de modifier une consultation terminée');
  }

  return prisma.consultation.update({
    where: { id },
    data: {
      ...(dto.motifPrincipal && { motifPrincipal: dto.motifPrincipal }),
      ...(dto.symptomes && { symptomes: dto.symptomes }),
      ...(dto.notesAsc && { notesAsc: dto.notesAsc }),
      ...(dto.protocoleUtilise && { protocoleUtilise: dto.protocoleUtilise }),
      ...(dto.confianceIa !== undefined && { confianceIa: dto.confianceIa }),
    },
  });
}

// ─── Saisir les constantes vitales ───────────────────────
export async function saveVitals(idConsultation: string, dto: VitalsDto) {
  const consultation = await prisma.consultation.findUnique({
    where: { id: idConsultation },
    include: { constantes: true },
  });

  if (!consultation) {
    throw new Error('Consultation non trouvée');
  }

  // Calculer les alertes automatiques
  const alertes: string[] = [];
  if (dto.temperature && dto.temperature > 39.5) alertes.push('Fièvre élevée > 39.5°C');
  if (dto.spo2 && dto.spo2 < 95) alertes.push('SpO2 critique < 95%');
  if (dto.frequenceRespiratoire && dto.frequenceRespiratoire > 50) alertes.push('Fréquence respiratoire élevée > 50/min');
  if (dto.tensionSystolique && dto.tensionSystolique > 180) alertes.push('Tension systolique dangereuse > 180 mmHg');
  if (dto.glycemie && dto.glycemie > 3) alertes.push('Glycémie critique > 3 g/L');

  // Créer ou mettre à jour les constantes
  if (consultation.constantes) {
    return prisma.constantesVitales.update({
      where: { idConsultation },
      data: { ...dto, alertes },
    });
  }

  return prisma.constantesVitales.create({
    data: {
      idConsultation,
      ...dto,
      alertes,
    },
  });
}

// ─── Clôturer une consultation ────────────────────────────
export async function completeConsultation(id: string) {
  const consultation = await prisma.consultation.findUnique({
    where: { id },
    include: {
      constantes: true,
      diagnostics: true,
      ordonnances: true,
    },
  });

  if (!consultation) {
    throw new Error('Consultation non trouvée');
  }

  if (consultation.statut === EncounterStatus.TERMINEE) {
    throw new Error('Consultation déjà terminée');
  }

  return prisma.consultation.update({
    where: { id },
    data: { statut: EncounterStatus.TERMINEE },
  });
}

// ─── Ajouter un diagnostic ────────────────────────────────
export async function addDiagnostic(
  idConsultation: string,
  dto: DiagnosticDto
) {
  const consultation = await prisma.consultation.findUnique({
    where: { id: idConsultation },
  });

  if (!consultation) {
    throw new Error('Consultation non trouvée');
  }

  return prisma.diagnostic.create({
    data: {
      idConsultation,
      libelle: dto.libelle,
      codeIcd11: dto.codeIcd11,
      typeDiagnostic: dto.typeDiagnostic ?? 'PRINCIPAL',
      source: dto.source,
      severite: dto.severite,
      statutClinique: 'ACTIF',
    },
  });
}

// ─── Récupérer les diagnostics d'une consultation ────────
export async function getDiagnostics(idConsultation: string) {
  return prisma.diagnostic.findMany({
    where: { idConsultation },
    orderBy: { creeLe: 'asc' },
  });
}

// ─── Ajouter une ordonnance ───────────────────────────────
export async function addOrdonnance(
  idConsultation: string,
  dto: OrdonnanceDto
) {
  const consultation = await prisma.consultation.findUnique({
    where: { id: idConsultation },
  });

  if (!consultation) {
    throw new Error('Consultation non trouvée');
  }

  // Vérifier que le médicament existe
  const medicament = await prisma.medicament.findUnique({
    where: { id: dto.idMedicament },
  });

  if (!medicament) {
    throw new Error('Médicament non trouvé');
  }

  return prisma.ordonnance.create({
    data: {
      idConsultation,
      idMedicament: dto.idMedicament,
      posologie: dto.posologie,
      frequence: dto.frequence,
      dureeJours: dto.dureeJours,
      instructions: dto.instructions,
    },
    include: { medicament: true },
  });
}

// ─── Créer un référencement ───────────────────────────────
export async function createReferral(
  idConsultation: string,
  dto: ReferralDto
) {
  const consultation = await prisma.consultation.findUnique({
    where: { id: idConsultation },
    include: { referencement: true },
  });

  if (!consultation) {
    throw new Error('Consultation non trouvée');
  }

  if (consultation.referencement) {
    throw new Error('Un référencement existe déjà pour cette consultation');
  }

  // Vérifier que la structure cible existe
  const structure = await prisma.structureSante.findUnique({
    where: { id: dto.idStructureCible },
  });

  if (!structure) {
    throw new Error('Structure de santé cible non trouvée');
  }

  // Mettre à jour le statut de la consultation
  await prisma.consultation.update({
    where: { id: idConsultation },
    data: { statut: EncounterStatus.REFERENCEE },
  });

  return prisma.referencement.create({
    data: {
      idConsultation,
      idStructureCible: dto.idStructureCible,
      urgence: dto.urgence,
      resumeClinique: dto.resumeClinique,
    },
    include: { structureCible: true },
  });
}

// ─── Liste des consultations avec filtres ─────────────────
export async function getConsultations(filters: ConsultationFilters) {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 20;
  const skip = (page - 1) * limit;

  const where = {
    ...(filters.idPatient && { idPatient: filters.idPatient }),
    ...(filters.idAsc && { idAsc: filters.idAsc }),
    ...(filters.statut && { statut: filters.statut }),
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
        constantes: true,
        diagnostics: true,
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
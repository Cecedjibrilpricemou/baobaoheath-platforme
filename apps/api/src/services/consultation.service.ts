import { EncounterStatus, SyncOperation } from '../config/generated/client/client';
import { prisma } from '../config/prisma';
import { JwtPayload } from '../types/auth.types';
import {
  ConsultationFilters,
  CreateConsultationDto,
  DiagnosticDto,
  OrdonnanceDto,
  ReferralDto,
  UpdateConsultationDto,
  VitalsDto,
} from '../types/consultation.types';
import {
  assertCanAccessConsultation,
  assertCanAccessPatient,
  buildConsultationWhereForUser,
} from './access-control.service';
import { recordSyncEvent } from './sync.service';
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/app-error';

async function getAscForUser(userId: string) {
  const asc = await prisma.ascProfile.findUnique({
    where: { idUtilisateur: userId },
    select: { id: true, idStructure: true },
  });

  if (!asc) throw new NotFoundError('Profil ASC non trouve');
  return asc;
}

async function assertCanModifyAsAsc(user: JwtPayload, idConsultation: string) {
  const asc = await getAscForUser(user.userId);
  const consultation = await prisma.consultation.findFirst({
    where: { id: idConsultation, idAsc: asc.id },
    select: { id: true, statut: true },
  });

  if (!consultation) throw new ForbiddenError('Acces refuse a cette consultation');
  if (consultation.statut === EncounterStatus.TERMINEE) {
    throw new ValidationError('Impossible de modifier une consultation terminee');
  }

  return { asc, consultation };
}

export async function createConsultation(
  user: JwtPayload,
  dto: CreateConsultationDto
) {
  const asc = await getAscForUser(user.userId);
  const patient = await prisma.patientProfile.findUnique({
    where: { id: dto.idPatient },
    select: { id: true },
  });

  if (!patient) throw new NotFoundError('Patient non trouve');
  await assertCanAccessPatient(user, dto.idPatient);

  const consultation = await prisma.consultation.create({
    data: {
      idPatient: dto.idPatient,
      idAsc: asc.id,
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

  await recordSyncEvent({
    scope: 'medical',
    entityType: 'Consultation',
    entityId: consultation.id,
    operation: SyncOperation.CREATE,
    idUtilisateur: user.userId,
    idStructure: asc.idStructure ?? undefined,
    payload: { idPatient: dto.idPatient, statut: consultation.statut },
  });

  return consultation;
}

export async function getConsultationById(user: JwtPayload, id: string) {
  await assertCanAccessConsultation(user, id);

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

  if (!consultation) throw new NotFoundError('Consultation non trouvee');
  return consultation;
}

export async function updateConsultation(
  user: JwtPayload,
  id: string,
  dto: UpdateConsultationDto
) {
  const { asc } = await assertCanModifyAsAsc(user, id);

  const updated = await prisma.consultation.update({
    where: { id },
    data: {
      ...(dto.motifPrincipal && { motifPrincipal: dto.motifPrincipal }),
      ...(dto.symptomes && { symptomes: dto.symptomes }),
      ...(dto.notesAsc && { notesAsc: dto.notesAsc }),
      ...(dto.protocoleUtilise && { protocoleUtilise: dto.protocoleUtilise }),
      ...(dto.confianceIa !== undefined && { confianceIa: dto.confianceIa }),
    },
  });

  await recordSyncEvent({
    scope: 'medical',
    entityType: 'Consultation',
    entityId: id,
    operation: SyncOperation.UPDATE,
    idUtilisateur: user.userId,
    idStructure: asc.idStructure ?? undefined,
    payload: dto,
  });

  return updated;
}

export async function saveVitals(user: JwtPayload, idConsultation: string, dto: VitalsDto) {
  const { asc } = await assertCanModifyAsAsc(user, idConsultation);
  const consultation = await prisma.consultation.findUnique({
    where: { id: idConsultation },
    include: { constantes: true },
  });

  if (!consultation) throw new NotFoundError('Consultation non trouvee');

  const alertes: string[] = [];
  if (dto.temperature && dto.temperature > 39.5) alertes.push('Fievre elevee > 39.5 C');
  if (dto.spo2 && dto.spo2 < 95) alertes.push('SpO2 critique < 95%');
  if (dto.frequenceRespiratoire && dto.frequenceRespiratoire > 50) alertes.push('Frequence respiratoire elevee > 50/min');
  if (dto.tensionSystolique && dto.tensionSystolique > 180) alertes.push('Tension systolique dangereuse > 180 mmHg');
  if (dto.glycemie && dto.glycemie > 3) alertes.push('Glycemie critique > 3 g/L');

  const vitals = consultation.constantes
    ? await prisma.constantesVitales.update({
        where: { idConsultation },
        data: { ...dto, alertes },
      })
    : await prisma.constantesVitales.create({
        data: {
          idConsultation,
          ...dto,
          alertes,
        },
      });

  await recordSyncEvent({
    scope: 'medical',
    entityType: 'ConstantesVitales',
    entityId: vitals.id,
    operation: consultation.constantes ? SyncOperation.UPDATE : SyncOperation.CREATE,
    idUtilisateur: user.userId,
    idStructure: asc.idStructure ?? undefined,
    payload: { idConsultation, alertes },
  });

  return vitals;
}

export async function completeConsultation(user: JwtPayload, id: string) {
  const { asc } = await assertCanModifyAsAsc(user, id);

  const consultation = await prisma.consultation.findUnique({
    where: { id },
    include: {
      constantes: true,
      diagnostics: true,
      ordonnances: true,
    },
  });

  if (!consultation) throw new NotFoundError('Consultation non trouvee');
  if (consultation.statut === EncounterStatus.TERMINEE) throw new ValidationError('Consultation deja terminee');

  const updated = await prisma.consultation.update({
    where: { id },
    data: { statut: EncounterStatus.TERMINEE },
  });

  await recordSyncEvent({
    scope: 'medical',
    entityType: 'Consultation',
    entityId: id,
    operation: SyncOperation.UPDATE,
    idUtilisateur: user.userId,
    idStructure: asc.idStructure ?? undefined,
    payload: { statut: EncounterStatus.TERMINEE },
  });

  return updated;
}

export async function addDiagnostic(
  user: JwtPayload,
  idConsultation: string,
  dto: DiagnosticDto
) {
  if (user.role === 'MEDECIN') {
    await assertCanAccessConsultation(user, idConsultation);
  } else {
    await assertCanModifyAsAsc(user, idConsultation);
  }

  const diagnostic = await prisma.diagnostic.create({
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

  await recordSyncEvent({
    scope: 'medical',
    entityType: 'Diagnostic',
    entityId: diagnostic.id,
    operation: SyncOperation.CREATE,
    idUtilisateur: user.userId,
    payload: { idConsultation, libelle: diagnostic.libelle },
  });

  return diagnostic;
}

export async function getDiagnostics(user: JwtPayload, idConsultation: string) {
  await assertCanAccessConsultation(user, idConsultation);

  return prisma.diagnostic.findMany({
    where: { idConsultation },
    orderBy: { creeLe: 'asc' },
  });
}

export async function addOrdonnance(
  user: JwtPayload,
  idConsultation: string,
  dto: OrdonnanceDto
) {
  if (user.role === 'MEDECIN') {
    await assertCanAccessConsultation(user, idConsultation);
  } else {
    await assertCanModifyAsAsc(user, idConsultation);
  }

  const medicament = await prisma.medicament.findUnique({
    where: { id: dto.idMedicament },
  });

  if (!medicament) throw new NotFoundError('Medicament non trouve');

  const ordonnance = await prisma.ordonnance.create({
    data: {
      idConsultation,
      idMedicament: dto.idMedicament,
      posologie: dto.posologie,
      frequence: dto.frequence,
      dureeJours: dto.dureeJours,
      quantite: dto.quantite ?? 1,
      instructions: dto.instructions,
    },
    include: { medicament: true },
  });

  await recordSyncEvent({
    scope: 'medical',
    entityType: 'Ordonnance',
    entityId: ordonnance.id,
    operation: SyncOperation.CREATE,
    idUtilisateur: user.userId,
    payload: { idConsultation, idMedicament: dto.idMedicament, quantite: ordonnance.quantite },
  });

  return ordonnance;
}

// ── AMÉLIORATION : $transaction pour garantir atomicité consultation + referencement ──
export async function createReferral(
  user: JwtPayload,
  idConsultation: string,
  dto: ReferralDto
) {
  const { asc } = await assertCanModifyAsAsc(user, idConsultation);
  const consultation = await prisma.consultation.findUnique({
    where: { id: idConsultation },
    include: { referencement: true },
  });

  if (!consultation) throw new NotFoundError('Consultation non trouvee');
  if (consultation.referencement) throw new ValidationError('Un referencement existe deja pour cette consultation');

  const structure = await prisma.structureSante.findUnique({
    where: { id: dto.idStructureCible },
  });

  if (!structure) throw new NotFoundError('Structure de sante cible non trouvee');

  const referral = await prisma.$transaction(async (tx) => {
    await tx.consultation.update({
      where: { id: idConsultation },
      data: { statut: EncounterStatus.REFERENCEE },
    });

    return tx.referencement.create({
      data: {
        idConsultation,
        idStructureSource: asc.idStructure,
        idStructureCible: dto.idStructureCible,
        urgence: dto.urgence,
        resumeClinique: dto.resumeClinique,
      },
      include: { structureCible: true },
    });
  });

  await recordSyncEvent({
    scope: 'medical',
    entityType: 'Referencement',
    entityId: referral.id,
    operation: SyncOperation.CREATE,
    idUtilisateur: user.userId,
    idStructure: asc.idStructure ?? undefined,
    payload: { idConsultation, idStructureCible: dto.idStructureCible, urgence: dto.urgence },
  });

  return referral;
}

export async function getConsultations(user: JwtPayload, filters: ConsultationFilters) {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 20;
  const skip = (page - 1) * limit;

  const where = {
    AND: [
      await buildConsultationWhereForUser(user),
      {
        ...(filters.idPatient && { idPatient: filters.idPatient }),
        ...(filters.idAsc && { idAsc: filters.idAsc }),
        ...(filters.statut && { statut: filters.statut }),
      },
    ],
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

export async function getMesConsultations(
  userId: string,
  filters: ConsultationFilters
) {
  const patient = await prisma.patientProfile.findUnique({
    where: { idUtilisateur: userId },
    select: { id: true },
  });

  if (!patient) throw new NotFoundError('Profil patient non trouve');

  const page = filters.page ?? 1;
  const limit = filters.limit ?? 20;
  const skip = (page - 1) * limit;

  const where = {
    idPatient: patient.id,
    ...(filters.statut && { statut: filters.statut }),
  };

  const [consultations, total] = await Promise.all([
    prisma.consultation.findMany({
      where,
      skip,
      take: limit,
      include: {
        constantes: true,
        diagnostics: true,
        ordonnances: { include: { medicament: true } },
        facture: true,
      },
      orderBy: { consulteeLE: 'desc' },
    }),
    prisma.consultation.count({ where }),
  ]);

  return {
    data: consultations,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
}

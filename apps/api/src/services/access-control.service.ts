import { Prisma } from '../config/generated/client/client';
import { prisma } from '../config/prisma';
import { JwtPayload } from '../types/auth.types';
import { ForbiddenError } from '../utils/app-error';

type PatientWhere = Prisma.PatientProfileWhereInput;
type ConsultationWhere = Prisma.ConsultationWhereInput;

const ADMIN_ROLES = new Set(['ADMIN_REGIONAL', 'ADMIN_NATIONAL', 'SUPER_ADMIN']);

export async function buildPatientWhereForUser(user: JwtPayload): Promise<PatientWhere> {
  if (ADMIN_ROLES.has(user.role)) return {};

  const utilisateur = await prisma.utilisateur.findUnique({
    where: { id: user.userId },
    select: {
      role: true,
      idStructure: true,
      patientProfile: { select: { id: true } },
      ascProfile: { select: { id: true, idStructure: true } },
      medecinProfile: { select: { idStructure: true } },
      pharmacienProfile: { select: { idStructure: true } },
    },
  });

  if (!utilisateur) return { id: '__forbidden__' };

  if (utilisateur.patientProfile) return { id: utilisateur.patientProfile.id };

  const idStructure =
    utilisateur.idStructure ??
    utilisateur.ascProfile?.idStructure ??
    utilisateur.medecinProfile?.idStructure ??
    utilisateur.pharmacienProfile?.idStructure;

  if (utilisateur.ascProfile) {
    return {
      OR: [
        { idAscPrincipal: utilisateur.ascProfile.id },
        { consultations: { some: { idAsc: utilisateur.ascProfile.id } } },
        ...(idStructure ? [{ idStructurePreferee: idStructure }] : []),
      ],
    };
  }

  if (user.role === 'MEDECIN') {
    return {
      consultations: {
        some: {
          OR: [
            { idMedecinValideur: user.userId },
            ...(idStructure ? [{ asc: { idStructure } }] : []),
            ...(idStructure ? [{ referencement: { idStructureCible: idStructure } }] : []),
          ],
        },
      },
    };
  }

  if (user.role === 'ADMIN_STRUCTURE' && idStructure) {
    return {
      OR: [
        { idStructurePreferee: idStructure },
        { consultations: { some: { asc: { idStructure } } } },
        { consultations: { some: { referencement: { idStructureCible: idStructure } } } },
      ],
    };
  }

  if (user.role === 'PHARMACIEN' && idStructure) {
    return {
      consultations: {
        some: {
          ordonnances: { some: { statut: 'EN_ATTENTE' } },
        },
      },
    };
  }

  return { id: '__forbidden__' };
}

export async function buildConsultationWhereForUser(user: JwtPayload): Promise<ConsultationWhere> {
  if (ADMIN_ROLES.has(user.role)) return {};

  const patientWhere = await buildPatientWhereForUser(user);

  if (user.role === 'ASC' || user.role === 'ASC_SUPERVISOR') {
    const asc = await prisma.ascProfile.findUnique({
      where: { idUtilisateur: user.userId },
      select: { id: true, idStructure: true },
    });

    if (!asc) return { id: '__forbidden__' };

    return {
      OR: [
        { idAsc: asc.id },
        { patient: patientWhere },
      ],
    };
  }

  if (user.role === 'MEDECIN') {
    const medecin = await prisma.medecinProfile.findUnique({
      where: { idUtilisateur: user.userId },
      select: { idStructure: true },
    });

    return {
      OR: [
        { idMedecinValideur: user.userId },
        ...(medecin?.idStructure ? [{ asc: { idStructure: medecin.idStructure } }] : []),
        ...(medecin?.idStructure ? [{ referencement: { idStructureCible: medecin.idStructure } }] : []),
      ],
    };
  }

  if (user.role === 'ADMIN_STRUCTURE') {
    const utilisateur = await prisma.utilisateur.findUnique({
      where: { id: user.userId },
      select: { idStructure: true },
    });

    if (!utilisateur?.idStructure) return { id: '__forbidden__' };

    return {
      OR: [
        { asc: { idStructure: utilisateur.idStructure } },
        { referencement: { idStructureCible: utilisateur.idStructure } },
      ],
    };
  }

  if (user.role === 'PATIENT') return { patient: patientWhere };

  return { id: '__forbidden__' };
}

export async function assertCanAccessPatient(user: JwtPayload, idPatient: string): Promise<void> {
  const patient = await prisma.patientProfile.findFirst({
    where: { AND: [{ id: idPatient }, await buildPatientWhereForUser(user)] },
    select: { id: true },
  });

  if (!patient) throw new ForbiddenError('Acces refuse au dossier patient');
}

export async function assertCanAccessConsultation(user: JwtPayload, idConsultation: string): Promise<void> {
  const consultation = await prisma.consultation.findFirst({
    where: { AND: [{ id: idConsultation }, await buildConsultationWhereForUser(user)] },
    select: { id: true },
  });

  if (!consultation) throw new ForbiddenError('Acces refuse a cette consultation');
}

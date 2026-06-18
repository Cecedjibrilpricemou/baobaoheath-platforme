import { ConsentScope } from '../config/generated/client/client';
import { prisma } from '../config/prisma';

export async function getPatientForUser(userId: string) {
  const patient = await prisma.patientProfile.findUnique({
    where: { idUtilisateur: userId },
    select: { id: true },
  });

  if (!patient) throw new Error('Profil patient non trouve');
  return patient;
}

export async function getMyConsents(userId: string) {
  const patient = await getPatientForUser(userId);

  return prisma.consentementPatient.findMany({
    where: { idPatient: patient.id },
    orderBy: { donneLe: 'desc' },
  });
}

export async function setConsent(
  userId: string,
  scope: ConsentScope,
  actif: boolean,
  source = 'WEB',
  commentaire?: string
) {
  const patient = await getPatientForUser(userId);

  return prisma.consentementPatient.upsert({
    where: {
      idPatient_scope: {
        idPatient: patient.id,
        scope,
      },
    },
    update: {
      actif,
      retireLe: actif ? null : new Date(),
      source,
      commentaire,
    },
    create: {
      idPatient: patient.id,
      idUtilisateur: userId,
      scope,
      actif,
      source,
      commentaire,
      retireLe: actif ? undefined : new Date(),
    },
  });
}

export async function assertPatientConsent(
  idPatient: string,
  scope: ConsentScope,
  requesterUserId?: string
) {
  const patient = await prisma.patientProfile.findUnique({
    where: { id: idPatient },
    select: { idUtilisateur: true },
  });

  if (!patient) throw new Error('Patient non trouve');
  if (requesterUserId && patient.idUtilisateur === requesterUserId) return;

  const consent = await prisma.consentementPatient.findUnique({
    where: { idPatient_scope: { idPatient, scope } },
  });

  if (!consent?.actif) {
    throw new Error(`Consentement requis: ${scope}`);
  }
}

export async function getMyAuditLogs(userId: string, params: { page?: number; limit?: number }) {
  const patient = await getPatientForUser(userId);
  const page = params.page ?? 1;
  const limit = Math.min(params.limit ?? 50, 100);
  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    prisma.journalAudit.findMany({
      where: {
        OR: [
          { idRessource: patient.id },
          { metadonnees: { path: ['params', 'id'], equals: patient.id } },
          { metadonnees: { path: ['body', 'idPatient'], equals: patient.id } },
          { metadonnees: { path: ['query', 'idPatient'], equals: patient.id } },
        ],
      },
      include: {
        utilisateur: {
          select: { id: true, prenom: true, nom: true, role: true },
        },
      },
      skip,
      take: limit,
      orderBy: { creeLe: 'desc' },
    }),
    prisma.journalAudit.count({
      where: {
        OR: [
          { idRessource: patient.id },
          { metadonnees: { path: ['params', 'id'], equals: patient.id } },
          { metadonnees: { path: ['body', 'idPatient'], equals: patient.id } },
          { metadonnees: { path: ['query', 'idPatient'], equals: patient.id } },
        ],
      },
    }),
  ]);

  return {
    data: logs,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
}

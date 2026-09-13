import { ConsentScope } from '../config/generated/client/client';
import { prisma } from '../config/prisma';
import { ForbiddenError, NotFoundError } from '../utils/app-error';
import { getValeursParametres } from './parametres.service';

// Consentements accordes d'office a la creation d'un dossier quand le
// super-admin l'a choisi (securite.consentementDefaut). Uniquement ceux
// necessaires aux soins : l'export FHIR et la recherche restent opt-in.
const SCOPES_SOINS: ConsentScope[] = [ConsentScope.DOSSIER_MEDICAL, ConsentScope.RAPPELS_SMS];
export const SOURCE_DEFAUT_SYSTEME = 'DEFAUT_SYSTEME';

// Le client etendu (chiffrement de champs) n'est pas assignable a
// Prisma.TransactionClient : on ne demande que ce qu'on utilise.
type ClientConsentements = Pick<typeof prisma, 'consentementPatient'>;

/**
 * A appeler dans la transaction qui cree le PatientProfile. Le patient peut
 * retirer chaque consentement ensuite depuis sa page Consentements.
 */
export async function initialiserConsentementsParDefaut(
  tx: ClientConsentements,
  idPatient: string,
  idUtilisateur: string,
): Promise<void> {
  const { securite } = await getValeursParametres();
  if (!securite.consentementDefaut) return;

  await tx.consentementPatient.createMany({
    data: SCOPES_SOINS.map((scope) => ({
      idPatient,
      idUtilisateur,
      scope,
      actif: true,
      source: SOURCE_DEFAUT_SYSTEME,
    })),
    skipDuplicates: true,
  });
}

export async function getPatientForUser(userId: string) {
  const patient = await prisma.patientProfile.findUnique({
    where: { idUtilisateur: userId },
    select: { id: true },
  });

  if (!patient) throw new NotFoundError('Profil patient non trouve');
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

  if (!patient) throw new NotFoundError('Patient non trouve');
  if (requesterUserId && patient.idUtilisateur === requesterUserId) return;

  const consent = await prisma.consentementPatient.findUnique({
    where: { idPatient_scope: { idPatient, scope } },
  });

  if (!consent?.actif) {
    throw new ForbiddenError(`Consentement requis: ${scope}`);
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

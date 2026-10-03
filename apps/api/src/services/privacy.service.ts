import { ConsentScope } from '../config/generated/client/client';
import { prisma } from '../config/prisma';
import { ForbiddenError, NotFoundError } from '../utils/app-error';
import { getValeursParametres } from './parametres.service';
import { libelleAcces } from './libelle-acces';
import type { AccesDossierView, PaginationMeta } from '@baobaoheath/shared-types';

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

/**
 * « Qui a consulte mon dossier ? » (EF-02-08)
 *
 * **Avant le 2026-10-03**, cette fonction interrogeait quatre predicats JSON
 * en OU — `metadonnees.params.id`, `metadonnees.body.idPatient`,
 * `metadonnees.query.idPatient` et `idRessource`. Deux defauts :
 *
 *   - aucun index ne pouvait la servir, et `metadonnees` contient la requete
 *     entiere, donc le cout grandissait avec le journal ;
 *   - **elle manquait le scan d'un QR au comptoir**, qui ne laisse le patient
 *     que dans `metadonnees.params.qrCode` — clause absente. Mesure sur la
 *     base de demonstration : 30 scans invisibles pour la patiente concernee.
 *
 * Depuis, le patient concerne vit dans la colonne indexee
 * `idPatientConcerne`. Verifie avant bascule : la nouvelle requete est un
 * **sur-ensemble strict** de l'ancienne — 181 lignes contre 37, aucune perdue
 * — et le plan d'execution montre bien un parcours d'index, sans tri.
 *
 * `parTiers: true` ne garde que les acces d'autrui. Un patient qui cherche
 * une anomalie cherche cela ; ses propres consultations representaient 273
 * lignes sur 850 dans la base de demonstration.
 */
export async function getMyAuditLogs(
  userId: string,
  params: { page?: number; limit?: number; parTiers?: boolean }
): Promise<{ data: AccesDossierView[]; meta: PaginationMeta }> {
  const patient = await getPatientForUser(userId);
  const page = params.page ?? 1;
  const limit = Math.min(params.limit ?? 50, 100);
  const skip = (page - 1) * limit;

  const ou = {
    idPatientConcerne: patient.id,
    ...(params.parTiers ? { idUtilisateur: { not: userId } } : {}),
  };

  const [logs, total] = await Promise.all([
    prisma.journalAudit.findMany({
      where: ou,
      include: {
        utilisateur: {
          select: { id: true, prenom: true, nom: true, role: true },
        },
      },
      skip,
      take: limit,
      orderBy: { creeLe: 'desc' },
    }),
    prisma.journalAudit.count({ where: ou }),
  ]);

  return {
    data: logs.map((l) => {
      const parMoi = l.idUtilisateur === userId;
      const { cle, objet } = libelleAcces({ action: l.action, ressource: l.ressource }, parMoi);
      return {
        id: l.id,
        action: l.action,
        ressource: l.ressource,
        idRessource: l.idRessource,
        libelle: cle,
        libelleObjet: objet,
        parMoi,
        statutHttp: l.statutHttp,
        creeLe: l.creeLe.toISOString(),
        utilisateur: l.utilisateur,
      };
    }),
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
}

import { StatutDemandeRgpd, TypeDemandeRgpd } from '../config/generated/client/client';
import { prisma } from '../config/prisma';
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/app-error';
import type { DemandeRgpdView, FileDemandesView } from '@baobaoheath/shared-types';

/**
 * Les demandes d'exercice de droits (EF-12-09).
 *
 * **Ce que ce service permet, et ce qu'il ne permet pas.** Il enregistre une
 * demande, la fait suivre, et oblige a y repondre par ecrit. Il **n'execute
 * rien automatiquement** : ni effacement, ni rectification d'un dossier de
 * soins. C'est volontaire.
 *
 * Un dossier de soins est soumis a une duree de conservation ; l'effacer sur
 * simple demande serait illegal, et le journal d'audit doit survivre de toute
 * facon — c'est pourquoi `JournalAudit.idPatientConcerne` est en
 * `onDelete: Restrict`. Ce que la plateforme peut offrir est une
 * **anonymisation de l'identite**, le dossier restant pour sa duree legale.
 * Cette anonymisation reste a construire ; en attendant, une demande
 * d'effacement se traite a la main et la reponse ecrite dit ce qui a ete fait.
 *
 * Le projet a deja paye l'absence de ce cadre : 15 comptes de la base de
 * demonstration ont vu leur telephone remplace par « purged-<id> » le
 * 2026-08-04, sans trace ni dans le journal ni dans le code — et a moitie
 * seulement, nom et prenom etant restes lisibles.
 */

/**
 * Le delai de reponse, en jours.
 *
 * Le RGPD donne un mois, prolongeable a trois pour une demande complexe. On
 * pose trente jours : la prolongation est une decision humaine, qui se
 * motive, pas une regle qu'un service applique seul.
 */
export const DELAI_JOURS = 30;

/** En deca, une reponse ne dit rien d'utile — la contrainte SQL l'exige aussi. */
const REPONSE_MIN = 10;

/** Au-dela, la demande est en retard : l'ecran doit le montrer en premier. */
export function joursRestants(dateLimite: Date, maintenant: Date): number {
  return Math.ceil((dateLimite.getTime() - maintenant.getTime()) / 86_400_000);
}

type Ligne = {
  id: string;
  type: TypeDemandeRgpd;
  statut: StatutDemandeRgpd;
  precision: string | null;
  dateLimite: Date;
  reponse: string | null;
  traiteLe: Date | null;
  creeLe: Date;
  patient: { utilisateur: { prenom: string; nom: string } } | null;
  traitePar: { prenom: string; nom: string } | null;
};

function enVue(l: Ligne, maintenant: Date): DemandeRgpdView {
  const close = l.statut === 'SATISFAITE' || l.statut === 'REFUSEE';
  const restants = joursRestants(l.dateLimite, maintenant);
  return {
    id: l.id,
    type: l.type,
    statut: l.statut,
    precision: l.precision,
    creeLe: l.creeLe.toISOString(),
    dateLimite: l.dateLimite.toISOString(),
    // Une demande close n'a plus de delai qui court : afficher « -3 jours »
    // sur une demande deja traitee donnerait une urgence qui n'existe plus.
    joursRestants: close ? null : restants,
    enRetard: !close && restants < 0,
    reponse: l.reponse,
    traiteLe: l.traiteLe?.toISOString() ?? null,
    traitePar: l.traitePar ? `${l.traitePar.prenom} ${l.traitePar.nom}` : null,
    demandeur: l.patient ? `${l.patient.utilisateur.prenom} ${l.patient.utilisateur.nom}` : 'Inconnu',
  };
}

const SELECTION = {
  id: true, type: true, statut: true, precision: true, dateLimite: true,
  reponse: true, traiteLe: true, creeLe: true,
  patient: { select: { utilisateur: { select: { prenom: true, nom: true } } } },
  traitePar: { select: { prenom: true, nom: true } },
};

async function profilDe(userId: string): Promise<{ id: string }> {
  const p = await prisma.patientProfile.findUnique({ where: { idUtilisateur: userId }, select: { id: true } });
  if (!p) throw new NotFoundError('Profil patient non trouve');
  return p;
}

// ── Cote patient ─────────────────────────────────────────────────────

export async function deposer(
  userId: string,
  type: TypeDemandeRgpd,
  precision: string | undefined,
  maintenant = new Date()
): Promise<DemandeRgpdView> {
  const patient = await profilDe(userId);

  // Une rectification sans precision est intraitable : on ne sait pas quoi
  // corriger, et l'administration devra rappeler le patient. Autant le lui
  // dire tout de suite.
  if (type === 'RECTIFICATION' && (precision ?? '').trim().length < REPONSE_MIN) {
    throw new ValidationError(
      'Precisez ce qui doit etre corrige : sans cela, votre demande ne peut pas etre traitee'
    );
  }

  // Une demande du meme type deja ouverte n'apporte rien et brouille la file.
  const ouverte = await prisma.demandeRgpd.findFirst({
    where: { idPatient: patient.id, type, statut: { in: ['RECUE', 'EN_COURS'] } },
    select: { id: true },
  });
  if (ouverte) {
    throw new ValidationError('Une demande de ce type est deja en cours de traitement');
  }

  const creee = await prisma.demandeRgpd.create({
    data: {
      type,
      idPatient: patient.id,
      precision: precision?.trim() || null,
      dateLimite: new Date(maintenant.getTime() + DELAI_JOURS * 86_400_000),
    },
    select: SELECTION,
  });
  return enVue(creee as Ligne, maintenant);
}

export async function mesDemandes(userId: string, maintenant = new Date()): Promise<DemandeRgpdView[]> {
  const patient = await profilDe(userId);
  const lignes = await prisma.demandeRgpd.findMany({
    where: { idPatient: patient.id },
    select: SELECTION,
    orderBy: { creeLe: 'desc' },
  });
  return (lignes as Ligne[]).map((l) => enVue(l, maintenant));
}

// ── Cote administration ──────────────────────────────────────────────

export async function file(
  filtres: { statut?: StatutDemandeRgpd; type?: TypeDemandeRgpd },
  maintenant = new Date()
): Promise<FileDemandesView> {
  const where: Record<string, unknown> = {};
  if (filtres.statut) where['statut'] = filtres.statut;
  if (filtres.type) where['type'] = filtres.type;

  const lignes = await prisma.demandeRgpd.findMany({
    where,
    select: SELECTION,
    // Les ouvertes d'abord, puis la plus urgente. L'index
    // `(statut, dateLimite)` sert exactement cela.
    orderBy: [{ statut: 'asc' }, { dateLimite: 'asc' }],
    take: 200,
  });

  const demandes = (lignes as Ligne[]).map((l) => enVue(l, maintenant));
  return {
    demandes,
    ouvertes: demandes.filter((d) => d.statut === 'RECUE' || d.statut === 'EN_COURS').length,
    enRetard: demandes.filter((d) => d.enRetard).length,
    delaiJours: DELAI_JOURS,
  };
}

export async function prendreEnCharge(
  agentId: string,
  idDemande: string,
  maintenant = new Date()
): Promise<DemandeRgpdView> {
  // Reclamation atomique : deux agents ne doivent pas se croire chacun en
  // charge de la meme demande.
  const { count } = await prisma.demandeRgpd.updateMany({
    where: { id: idDemande, statut: 'RECUE' },
    data: { statut: 'EN_COURS', idTraitePar: agentId },
  });
  if (count === 0) {
    const existe = await prisma.demandeRgpd.findUnique({ where: { id: idDemande }, select: { statut: true } });
    if (!existe) throw new NotFoundError('Demande introuvable');
    throw new ForbiddenError('Cette demande a deja ete prise en charge');
  }

  const vue = await prisma.demandeRgpd.findUniqueOrThrow({ where: { id: idDemande }, select: SELECTION });
  return enVue(vue as Ligne, maintenant);
}

export async function repondre(
  agentId: string,
  idDemande: string,
  satisfaite: boolean,
  reponse: string,
  maintenant = new Date()
): Promise<DemandeRgpdView> {
  const propre = reponse.trim();
  if (propre.length < REPONSE_MIN) {
    throw new ValidationError(
      `La reponse doit faire au moins ${REPONSE_MIN} caracteres : un refus qu'on ne motive pas n'est pas contestable, et une demande satisfaite doit dire ce qui a ete fait`
    );
  }

  const { count } = await prisma.demandeRgpd.updateMany({
    where: { id: idDemande, statut: { in: ['RECUE', 'EN_COURS'] } },
    data: {
      statut: satisfaite ? 'SATISFAITE' : 'REFUSEE',
      reponse: propre,
      traiteLe: maintenant,
      idTraitePar: agentId,
    },
  });
  if (count === 0) {
    const existe = await prisma.demandeRgpd.findUnique({ where: { id: idDemande }, select: { statut: true } });
    if (!existe) throw new NotFoundError('Demande introuvable');
    throw new ForbiddenError('Cette demande est deja close');
  }

  const vue = await prisma.demandeRgpd.findUniqueOrThrow({ where: { id: idDemande }, select: SELECTION });
  return enVue(vue as Ligne, maintenant);
}

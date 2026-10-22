import {
  Prisma,
  StatutSessionCaisse,
  StatutVente,
} from '../config/generated/client/client';
import { prisma } from '../config/prisma';
import type {
  CloturerSessionCaisseDto,
  OuvrirSessionCaisseDto,
  RapportCaisseView,
  SessionCaisseView,
} from '@baobaoheath/shared-types';
import { ConflictError, ForbiddenError, ValidationError } from '../utils/app-error';
import type { JwtPayload } from '../types/auth.types';
import { estTitulaire, officineDe } from './vente.service';

const SESSION_INCLUDE = {
  utilisateur: { select: { id: true, prenom: true, nom: true } },
} satisfies Prisma.SessionCaisseInclude;
const PLAFOND_MONTANT_GNF = 2_000_000_000;

type SessionAvecUtilisateur = Prisma.SessionCaisseGetPayload<{ include: typeof SESSION_INCLUDE }>;

function jour(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function bornes(periode: 'JOUR' | 'MOIS' | 'ANNEE', date: string | undefined) {
  const reference = date ? new Date(`${date}T00:00:00`) : new Date();
  if (Number.isNaN(reference.getTime())) throw new ValidationError('Date de rapport invalide');
  const debut = periode === 'ANNEE'
    ? new Date(reference.getFullYear(), 0, 1)
    : periode === 'MOIS'
      ? new Date(reference.getFullYear(), reference.getMonth(), 1)
      : jour(reference);
  const fin = periode === 'ANNEE'
    ? new Date(reference.getFullYear() + 1, 0, 1)
    : periode === 'MOIS'
      ? new Date(reference.getFullYear(), reference.getMonth() + 1, 1)
      : new Date(debut.getFullYear(), debut.getMonth(), debut.getDate() + 1);
  return { debut, fin };
}

async function versVuesSessions(sessions: SessionAvecUtilisateur[]): Promise<SessionCaisseView[]> {
  if (sessions.length === 0) return [];
  const groupes = await prisma.venteComptoir.groupBy({
    by: ['idSessionCaisse', 'statut', 'modePaiement'],
    where: { idSessionCaisse: { in: sessions.map((session) => session.id) } },
    _sum: { montantPatientGnf: true },
    _count: true,
  });
  const parSession = new Map<string, typeof groupes>();
  for (const groupe of groupes) {
    if (!groupe.idSessionCaisse) continue;
    const liste = parSession.get(groupe.idSessionCaisse) ?? [];
    liste.push(groupe);
    parSession.set(groupe.idSessionCaisse, liste);
  }

  return sessions.map((session) => {
    const ventes = parSession.get(session.id) ?? [];
    const especes = ventes
      .filter((vente) => vente.statut === StatutVente.PAYEE && vente.modePaiement === 'ESPECES')
      .reduce((total, vente) => total + (vente._sum.montantPatientGnf ?? 0), 0);
    const orangeMoney = ventes
      .filter((vente) => vente.statut === StatutVente.PAYEE && vente.modePaiement === 'ORANGE_MONEY')
      .reduce((total, vente) => total + (vente._sum.montantPatientGnf ?? 0), 0);
    const mtnMomo = ventes
      .filter((vente) => vente.statut === StatutVente.PAYEE && vente.modePaiement === 'MTN_MOMO')
      .reduce((total, vente) => total + (vente._sum.montantPatientGnf ?? 0), 0);
    const count = (statut: StatutVente) => ventes
      .filter((vente) => vente.statut === statut)
      .reduce((total, vente) => total + vente._count, 0);
    return {
      id: session.id,
      statut: session.statut,
      montantOuvertureGnf: session.montantOuvertureGnf,
      montantEspecesEncaisseGnf: session.montantEspecesEncaisseGnf ?? especes,
      montantOrangeMoneyGnf: session.montantOrangeMoneyGnf ?? orangeMoney,
      montantMtnMomoGnf: session.montantMtnMomoGnf ?? mtnMomo,
      montantTheoriqueGnf: session.montantTheoriqueGnf ?? session.montantOuvertureGnf + especes,
      montantCompteGnf: session.montantCompteGnf,
      ecartGnf: session.ecartGnf,
      motifEcart: session.motifEcart,
      ouverteLe: session.ouverteLe.toISOString(),
      clotureeLe: session.clotureeLe?.toISOString() ?? null,
      nombreVentesPayees: session.nombreVentesPayees ?? count(StatutVente.PAYEE),
      nombreVentesEnAttente: session.nombreVentesEnAttente ?? count(StatutVente.EN_ATTENTE),
      nombreVentesAnnulees: session.nombreVentesAnnulees ?? count(StatutVente.ANNULEE),
      utilisateur: session.utilisateur,
    };
  });
}

export async function sessionCourante(user: JwtPayload): Promise<SessionCaisseView | null> {
  const idStructure = await officineDe(user.userId);
  const maintenant = new Date();
  const debutJour = jour(maintenant);
  const sessions = await prisma.sessionCaisse.findMany({
    where: {
      idStructure,
      idUtilisateur: user.userId,
      OR: [
        { statut: StatutSessionCaisse.OUVERTE },
        { ouverteLe: { gte: debutJour } },
      ],
    },
    include: SESSION_INCLUDE,
    orderBy: { ouverteLe: 'desc' },
    take: 1,
  });
  return (await versVuesSessions(sessions))[0] ?? null;
}

export async function ouvrirSession(
  user: JwtPayload,
  dto: OuvrirSessionCaisseDto,
): Promise<SessionCaisseView> {
  if (!Number.isInteger(dto.montantOuvertureGnf) || dto.montantOuvertureGnf < 0
    || dto.montantOuvertureGnf > PLAFOND_MONTANT_GNF) {
    throw new ValidationError('Le fond de caisse doit etre un montant entier valide');
  }
  const idStructure = await officineDe(user.userId);
  const ouverte = await prisma.sessionCaisse.findFirst({
    where: { idStructure, idUtilisateur: user.userId, statut: StatutSessionCaisse.OUVERTE },
    select: { id: true },
  });
  if (ouverte) throw new ConflictError('Une session de caisse est deja ouverte');
  try {
    const session = await prisma.sessionCaisse.create({
      data: {
        idStructure,
        idUtilisateur: user.userId,
        montantOuvertureGnf: dto.montantOuvertureGnf,
      },
      include: SESSION_INCLUDE,
    });
    return (await versVuesSessions([session]))[0]!;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictError('Une session de caisse est deja ouverte');
    }
    throw error;
  }
}

export async function cloturerSession(
  user: JwtPayload,
  idSession: string,
  dto: CloturerSessionCaisseDto,
): Promise<SessionCaisseView> {
  if (!Number.isInteger(dto.montantCompteGnf) || dto.montantCompteGnf < 0
    || dto.montantCompteGnf > PLAFOND_MONTANT_GNF) {
    throw new ValidationError('Le montant compte doit etre un montant entier valide');
  }
  const idStructure = await officineDe(user.userId);
  const titulaire = await estTitulaire(user.userId);
  const session = await prisma.sessionCaisse.findFirst({
    where: { id: idSession, idStructure, ...(!titulaire ? { idUtilisateur: user.userId } : {}) },
    select: { id: true, statut: true, montantOuvertureGnf: true },
  });
  if (!session) throw new ForbiddenError('Cette session ne vous appartient pas');
  if (session.statut !== StatutSessionCaisse.OUVERTE) {
    throw new ConflictError('Cette session de caisse est deja cloturee');
  }

  await prisma.$transaction(async (tx) => {
    const verrou = await tx.sessionCaisse.updateMany({
      where: { id: session.id, statut: StatutSessionCaisse.OUVERTE },
      data: { version: { increment: 1 } },
    });
    if (verrou.count !== 1) throw new ConflictError('Cette session de caisse est deja cloturee');

    const groupes = await tx.venteComptoir.groupBy({
      by: ['statut', 'modePaiement'],
      where: {
        idSessionCaisse: session.id,
      },
      _sum: { montantPatientGnf: true },
      _count: true,
    });
    const montantMode = (mode: string) => groupes
      .filter((groupe) => groupe.statut === StatutVente.PAYEE && groupe.modePaiement === mode)
      .reduce((total, groupe) => total + (groupe._sum.montantPatientGnf ?? 0), 0);
    const nombreStatut = (statut: StatutVente) => groupes
      .filter((groupe) => groupe.statut === statut)
      .reduce((total, groupe) => total + groupe._count, 0);
    const especes = montantMode('ESPECES');
    const montantTheoriqueGnf = session.montantOuvertureGnf + especes;
    if (montantTheoriqueGnf > PLAFOND_MONTANT_GNF) {
      throw new ValidationError('Le montant theorique depasse le plafond de la caisse');
    }
    const ecartGnf = dto.montantCompteGnf - montantTheoriqueGnf;
    const motif = dto.motifEcart?.trim();
    if (ecartGnf !== 0 && (!motif || motif.length < 5)) {
      throw new ValidationError('Un motif de cinq caracteres est requis lorsque la caisse presente un ecart');
    }
    const cloture = await tx.sessionCaisse.updateMany({
      where: { id: session.id, statut: StatutSessionCaisse.OUVERTE },
      data: {
        statut: StatutSessionCaisse.CLOTUREE,
        montantEspecesEncaisseGnf: especes,
        montantOrangeMoneyGnf: montantMode('ORANGE_MONEY'),
        montantMtnMomoGnf: montantMode('MTN_MOMO'),
        montantTheoriqueGnf,
        montantCompteGnf: dto.montantCompteGnf,
        ecartGnf,
        motifEcart: motif || null,
        nombreVentesPayees: nombreStatut(StatutVente.PAYEE),
        nombreVentesEnAttente: nombreStatut(StatutVente.EN_ATTENTE),
        nombreVentesAnnulees: nombreStatut(StatutVente.ANNULEE),
        clotureeLe: new Date(),
      },
    });
    if (cloture.count !== 1) throw new ConflictError('Cette session de caisse est deja cloturee');
  });

  const cloturee = await prisma.sessionCaisse.findUniqueOrThrow({
    where: { id: session.id },
    include: SESSION_INCLUDE,
  });
  return (await versVuesSessions([cloturee]))[0]!;
}

export async function rapportCaisse(
  user: JwtPayload,
  periode: 'JOUR' | 'MOIS' | 'ANNEE',
  date?: string,
): Promise<RapportCaisseView> {
  const idStructure = await officineDe(user.userId);
  const titulaire = await estTitulaire(user.userId);
  const { debut, fin } = bornes(periode, date);
  const filtreVentes: Prisma.VenteComptoirWhereInput = {
    idStructure,
    creeLe: { gte: debut, lt: fin },
    ...(!titulaire ? { idVendeur: user.userId } : {}),
  };
  const [ventesParStatutMode, ventesParUtilisateur, sessions] = await Promise.all([
    prisma.venteComptoir.groupBy({
      by: ['statut', 'modePaiement'],
      where: filtreVentes,
      _sum: { montantNetGnf: true, montantPatientGnf: true },
      _count: true,
    }),
    titulaire
      ? prisma.venteComptoir.groupBy({
          by: ['idVendeur', 'statut'],
          where: filtreVentes,
          _sum: { montantNetGnf: true },
          _count: true,
        })
      : Promise.resolve([]),
    prisma.sessionCaisse.findMany({
      where: {
        idStructure,
        ouverteLe: { gte: debut, lt: fin },
        ...(!titulaire ? { idUtilisateur: user.userId } : {}),
      },
      include: SESSION_INCLUDE,
      orderBy: { ouverteLe: 'desc' },
    }),
  ]);

  const payees = ventesParStatutMode.filter((groupe) => groupe.statut === StatutVente.PAYEE);
  const nombreVentesPayees = payees.reduce((total, groupe) => total + groupe._count, 0);
  const montantParUtilisateur = new Map<string, { chiffreAffairesGnf: number; nombreVentesPayees: number }>();
  for (const groupe of ventesParUtilisateur) {
    if (groupe.statut !== StatutVente.PAYEE) continue;
    const cumul = montantParUtilisateur.get(groupe.idVendeur) ?? { chiffreAffairesGnf: 0, nombreVentesPayees: 0 };
    cumul.chiffreAffairesGnf += groupe._sum.montantNetGnf ?? 0;
    cumul.nombreVentesPayees += groupe._count;
    montantParUtilisateur.set(groupe.idVendeur, cumul);
  }
  const utilisateurs = montantParUtilisateur.size > 0
    ? await prisma.utilisateur.findMany({
        where: { id: { in: [...montantParUtilisateur.keys()] } },
        select: { id: true, prenom: true, nom: true },
      })
    : [];

  return {
    periode,
    dateDebut: debut.toISOString(),
    dateFin: new Date(fin.getTime() - 1).toISOString(),
    chiffreAffairesGnf: payees.reduce((total, groupe) => total + (groupe._sum.montantNetGnf ?? 0), 0),
    nombreVentesPayees,
    nombreVentesEnAttente: ventesParStatutMode
      .filter((groupe) => groupe.statut === StatutVente.EN_ATTENTE)
      .reduce((total, groupe) => total + groupe._count, 0),
    nombreVentesAnnulees: ventesParStatutMode
      .filter((groupe) => groupe.statut === StatutVente.ANNULEE)
      .reduce((total, groupe) => total + groupe._count, 0),
    encaissementsParMode: payees.map((groupe) => ({
      modePaiement: groupe.modePaiement,
      montantGnf: groupe._sum.montantPatientGnf ?? 0,
      nombre: groupe._count,
    })),
    parUtilisateur: utilisateurs.map((utilisateur) => ({
      utilisateur,
      ...montantParUtilisateur.get(utilisateur.id)!,
    })),
    sessions: await versVuesSessions(sessions),
  };
}

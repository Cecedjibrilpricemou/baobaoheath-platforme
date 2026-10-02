// src/services/assurance.service.ts
//
// Assurance et tiers payant (EF-09, addendum du 2026-09-28 point 5).
//
// Deux choses vivent ici, et une seule est difficile :
//
//   - le controle d'eligibilite, qui doit etre **opposable** : la reponse est
//     figee en base, jamais recalculee ;
//   - le calcul de la prise en charge, ligne par ligne. « Un reste a charge
//     sans explication se conteste au comptoir » : chaque ligne dit donc si
//     elle est couverte, a quel taux, et sinon pourquoi.
//
// Le calcul est une **fonction pure**, separee de toute lecture de base. C'est
// la partie que l'on ne peut pas se permettre d'avoir fausse : elle est
// testee pour elle-meme.
import { CategorieProduit, ModeEchangeAssureur, Prisma, StatutContrat, TypeStructure } from '../config/generated/client/client';
import { prisma } from '../config/prisma';
import { JwtPayload } from '../types/auth.types';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/app-error';
import type {
  AssureurView,
  ContratAssuranceView,
  ControleEligibiliteView,
  CouvertureLigneView,
  CreerAssureurDto,
  CreerContratDto,
  CreerRegleCouvertureDto,
  PriseEnChargeView,
} from '@baobaoheath/shared-types';

/** Une ligne a chiffrer, telle que la caisse la connait. */
export type LigneAChiffrer = {
  idMedicament: string;
  libelle: string;
  categorie: CategorieProduit;
  /** Montant de la ligne avant remise de caisse : quantite x prix unitaire. */
  montantGnf: number;
};

export type ContratPourCalcul = {
  id: string;
  tauxBasePourcent: number;
  plafondAnnuelGnf: number;
  franchiseGnf: number;
};

export type ReglePourCalcul = {
  categorie: CategorieProduit;
  exclu: boolean;
  tauxPourcent: number | null;
  plafondLigneGnf: number;
  dateEffet: Date;
};

/**
 * La regle en vigueur pour une categorie a une date donnee.
 *
 * `dateEffet` permet de changer un taux sans reecrire le passe : une vente de
 * mars se chiffre avec la regle de mars, pas avec celle d'aujourd'hui
 * (EF-09-03). On retient donc la plus recente parmi celles deja entrees en
 * vigueur.
 */
export function regleEnVigueur(
  regles: ReglePourCalcul[],
  categorie: CategorieProduit,
  date: Date
): ReglePourCalcul | null {
  const candidates = regles
    .filter((r) => r.categorie === categorie && r.dateEffet <= date)
    .sort((a, b) => b.dateEffet.getTime() - a.dateEffet.getTime());
  return candidates[0] ?? null;
}

/**
 * Repartit une baisse du total sur les lignes, au prorata de leur part.
 *
 * Quand une franchise ou un plafond rabote la part de l'assureur, le detail
 * ligne par ligne doit continuer a s'additionner jusqu'au total : sinon
 * l'ecran affiche une somme qui ne tombe pas juste, et c'est precisement ce
 * qu'un patient conteste. Les restes de division vont aux plus grosses
 * lignes, pour que la somme soit exacte au franc.
 */
export function repartir(montants: number[], cible: number): number[] {
  const total = montants.reduce((t, m) => t + m, 0);
  if (total === 0 || cible >= total) return [...montants];
  if (cible <= 0) return montants.map(() => 0);

  const exacts = montants.map((m) => (m * cible) / total);
  const planchers = exacts.map(Math.floor);
  let reste = cible - planchers.reduce((t, p) => t + p, 0);

  // Les plus fortes parties decimales d'abord : c'est la repartition qui
  // s'ecarte le moins du prorata exact.
  const ordre = exacts
    .map((e, i) => ({ i, frac: e - Math.floor(e) }))
    .sort((a, b) => b.frac - a.frac);

  const resultat = [...planchers];
  for (const { i } of ordre) {
    if (reste <= 0) break;
    resultat[i] = (resultat[i] ?? 0) + 1;
    reste--;
  }
  return resultat;
}

export type PriseEnCharge = {
  lignes: (CouvertureLigneView & { idMedicament: string })[];
  montantAssureGnf: number;
  montantPatientGnf: number;
  notes: string[];
};

/**
 * Ce que l'assureur prend, ligne par ligne.
 *
 * **Un taux de 100 % ne veut pas dire « tout est pris »** : il s'applique a ce
 * qui est couvert, apres exclusions, puis dans la limite de la franchise et
 * des plafonds. Un assure a 100 % paie quand meme son lait infantile.
 *
 * `montantNetGnf` est ce que la caisse encaisse, remise deduite. La part de
 * l'assureur est calculee sur les lignes **avant remise**, puis plafonnee au
 * net : la remise du pharmacien profite donc au patient, pas a l'assureur.
 * C'est un choix, signale dans les questions ouvertes.
 */
export function calculerPriseEnCharge(
  lignes: LigneAChiffrer[],
  contrat: ContratPourCalcul,
  regles: ReglePourCalcul[],
  dejaConsommeGnf: number,
  montantNetGnf: number,
  date = new Date()
): PriseEnCharge {
  const notes: string[] = [];

  const detail = lignes.map((l) => {
    const regle = regleEnVigueur(regles, l.categorie, date);

    if (regle?.exclu) {
      return {
        idMedicament: l.idMedicament,
        libelle: l.libelle,
        montantGnf: l.montantGnf,
        couvert: false,
        tauxAppliquePourcent: 0,
        montantAssureGnf: 0,
        motifExclusion: `Categorie ${l.categorie} exclue par l'assureur`,
      };
    }

    const taux = regle?.tauxPourcent ?? contrat.tauxBasePourcent;
    if (taux <= 0) {
      return {
        idMedicament: l.idMedicament,
        libelle: l.libelle,
        montantGnf: l.montantGnf,
        couvert: false,
        tauxAppliquePourcent: 0,
        montantAssureGnf: 0,
        motifExclusion: `Taux de 0 % pour la categorie ${l.categorie}`,
      };
    }

    let montant = Math.floor((l.montantGnf * taux) / 100);
    if (regle && regle.plafondLigneGnf > 0 && montant > regle.plafondLigneGnf) {
      montant = regle.plafondLigneGnf;
      notes.push(`${l.libelle} : plafond de ${regle.plafondLigneGnf} GNF par ligne applique`);
    }

    return {
      idMedicament: l.idMedicament,
      libelle: l.libelle,
      montantGnf: l.montantGnf,
      couvert: true,
      tauxAppliquePourcent: taux,
      montantAssureGnf: montant,
      motifExclusion: null as string | null,
    };
  });

  let total = detail.reduce((t, l) => t + l.montantAssureGnf, 0);

  // La franchise est toujours a la charge du patient.
  if (contrat.franchiseGnf > 0 && total > 0) {
    const avant = total;
    total = Math.max(0, total - contrat.franchiseGnf);
    notes.push(`Franchise de ${Math.min(contrat.franchiseGnf, avant)} GNF a la charge du patient`);
  }

  // Le plafond annuel : ce qui a deja ete pris cette annee compte.
  if (contrat.plafondAnnuelGnf > 0) {
    const restant = Math.max(0, contrat.plafondAnnuelGnf - dejaConsommeGnf);
    if (total > restant) {
      total = restant;
      notes.push(
        restant === 0
          ? 'Plafond annuel atteint : plus rien n est pris en charge'
          : `Plafond annuel : il restait ${restant} GNF de couverture`
      );
    }
  }

  // L'assureur ne prend jamais plus que ce que la caisse encaisse.
  if (total > montantNetGnf) {
    total = montantNetGnf;
    notes.push('Part de l assureur ramenee au montant encaisse, remise deduite');
  }

  // Le detail doit s'additionner jusqu'au total : sinon l'ecran affiche une
  // somme qui ne tombe pas juste.
  const repartis = repartir(detail.map((l) => l.montantAssureGnf), total);

  return {
    lignes: detail.map((l, i) => ({
      idMedicament: l.idMedicament,
      libelle: l.libelle,
      montantGnf: l.montantGnf,
      couvert: l.couvert && (repartis[i] ?? 0) > 0,
      tauxAppliquePourcent: (repartis[i] ?? 0) > 0 ? l.tauxAppliquePourcent : 0,
      montantAssureGnf: repartis[i] ?? 0,
      motifExclusion: l.motifExclusion,
    })),
    montantAssureGnf: total,
    montantPatientGnf: montantNetGnf - total,
    notes,
  };
}

/**
 * Pourquoi un contrat ne couvre pas, a cette date. `null` = il couvre.
 *
 * Fonction pure, pour que chaque refus soit teste pour lui-meme : c'est le
 * motif que le comptoir lira au patient, et qui sera oppose a l'assureur.
 */
export function motifDInegibilite(
  contrat: { statut: StatutContrat; dateEffet: Date; dateFin: Date | null; carenceJours: number },
  date = new Date()
): string | null {
  if (contrat.statut === StatutContrat.RESILIE) return 'Contrat resilie';
  if (contrat.statut === StatutContrat.SUSPENDU) return 'Contrat suspendu';
  if (date < contrat.dateEffet) return "Contrat pas encore en vigueur";
  if (contrat.dateFin && date > contrat.dateFin) return 'Contrat expire';

  if (contrat.carenceJours > 0) {
    const finCarence = new Date(contrat.dateEffet.getTime() + contrat.carenceJours * 86_400_000);
    if (date < finCarence) {
      return `Periode de carence en cours jusqu'au ${finCarence.toISOString().slice(0, 10)}`;
    }
  }
  return null;
}

/** La structure du demandeur, et son type. */
async function structureDe(userId: string): Promise<{ idStructure: string; type: TypeStructure }> {
  const u = await prisma.utilisateur.findUnique({
    where: { id: userId },
    select: { idStructure: true, structure: { select: { type: true } } },
  });
  if (!u?.idStructure || !u.structure) throw new ForbiddenError('Aucune structure rattachee a votre compte');
  return { idStructure: u.idStructure, type: u.structure.type };
}

/**
 * Controle d'eligibilite au comptoir (addendum, point 5.1).
 *
 * La reponse est enregistree telle quelle. On ne la recalcule jamais : c'est
 * elle qui justifiera le tiers payant si l'assureur le contente plus tard.
 */
export async function verifierEligibilite(
  user: JwtPayload,
  idPatient: string,
  maintenant = new Date()
): Promise<ControleEligibiliteView> {
  const { idStructure } = await structureDe(user.userId);

  const patient = await prisma.patientProfile.findUnique({
    where: { id: idPatient },
    select: { id: true, utilisateur: { select: { prenom: true, nom: true } } },
  });
  if (!patient) throw new NotFoundError('Patient non trouve');

  // Le contrat le plus recemment entre en vigueur : un patient peut avoir
  // change d'assureur, l'ancien contrat restant en base.
  const contrat = await prisma.contratAssurance.findFirst({
    where: { idPatient },
    include: { assureur: { select: { id: true, nom: true, code: true, estActif: true } } },
    orderBy: { dateEffet: 'desc' },
  });

  let eligible = false;
  let motif: string | null = null;

  if (!contrat) {
    motif = "Aucun contrat d'assurance enregistre pour ce patient";
  } else if (!contrat.assureur.estActif) {
    motif = `Assureur ${contrat.assureur.nom} inactif sur la plateforme`;
  } else {
    motif = motifDInegibilite(contrat, maintenant);
    eligible = motif === null;
  }

  const trace = await prisma.controleEligibilite.create({
    data: {
      eligible,
      motif,
      numeroPolice: contrat?.numeroPolice ?? null,
      tauxBasePourcent: eligible ? contrat!.tauxBasePourcent : null,
      idContrat: contrat?.id ?? null,
      idPatient,
      idStructure,
      idControlePar: user.userId,
    },
  });

  return {
    id: trace.id,
    eligible,
    motif,
    numeroPolice: trace.numeroPolice,
    tauxBasePourcent: trace.tauxBasePourcent,
    creeLe: trace.creeLe.toISOString(),
    patient: { id: patient.id, prenom: patient.utilisateur.prenom, nom: patient.utilisateur.nom },
    assureur: contrat ? { id: contrat.assureur.id, nom: contrat.assureur.nom, code: contrat.assureur.code } : null,
  };
}

/** Les controles passes sur un patient, le plus recent en tete. */
export async function historiqueEligibilite(user: JwtPayload, idPatient: string): Promise<ControleEligibiliteView[]> {
  await structureDe(user.userId);
  const traces = await prisma.controleEligibilite.findMany({
    where: { idPatient },
    include: {
      patient: { select: { id: true, utilisateur: { select: { prenom: true, nom: true } } } },
      contrat: { include: { assureur: { select: { id: true, nom: true, code: true } } } },
    },
    orderBy: { creeLe: 'desc' },
    take: 50,
  });

  return traces.map((t) => ({
    id: t.id,
    eligible: t.eligible,
    motif: t.motif,
    numeroPolice: t.numeroPolice,
    tauxBasePourcent: t.tauxBasePourcent,
    creeLe: t.creeLe.toISOString(),
    patient: { id: t.patient.id, prenom: t.patient.utilisateur.prenom, nom: t.patient.utilisateur.nom },
    assureur: t.contrat
      ? { id: t.contrat.assureur.id, nom: t.contrat.assureur.nom, code: t.contrat.assureur.code }
      : null,
  }));
}

/**
 * Chiffre une prise en charge sans rien enregistrer, pour que le comptoir la
 * montre **avant** le paiement (addendum, point 5.4).
 */
export async function simulerPriseEnCharge(
  user: JwtPayload,
  idPatient: string,
  lignes: LigneAChiffrer[],
  montantNetGnf: number,
  maintenant = new Date()
): Promise<PriseEnChargeView> {
  await structureDe(user.userId);
  const prise = await chiffrer(idPatient, lignes, montantNetGnf, maintenant);
  if (!prise) throw new ValidationError("Ce patient n'a pas de contrat d'assurance utilisable");
  return {
    idContrat: prise.idContrat,
    assureur: prise.assureur,
    montantNetGnf,
    montantAssureGnf: prise.montantAssureGnf,
    montantPatientGnf: prise.montantPatientGnf,
    notes: prise.notes,
    lignes: prise.lignes.map(({ idMedicament, ...reste }) => ({ idMedicament, ...reste })),
  };
}

/**
 * Le chiffrage complet : lit le contrat, ses regles, ce qui a deja ete
 * consomme cette annee, puis delegue au calcul pur. Rend `null` quand le
 * patient n'a pas de contrat exploitable — l'appelant decide alors s'il
 * refuse ou s'il encaisse en paiement direct (EF-09-09).
 */
export async function chiffrer(
  idPatient: string,
  lignes: LigneAChiffrer[],
  montantNetGnf: number,
  maintenant = new Date()
): Promise<(PriseEnCharge & { idContrat: string; assureur: { id: string; nom: string; code: string } }) | null> {
  const contrat = await prisma.contratAssurance.findFirst({
    where: { idPatient, statut: StatutContrat.ACTIF },
    include: {
      assureur: {
        select: {
          id: true, nom: true, code: true, estActif: true,
          regles: { select: { categorie: true, exclu: true, tauxPourcent: true, plafondLigneGnf: true, dateEffet: true } },
        },
      },
    },
    orderBy: { dateEffet: 'desc' },
  });
  if (!contrat || !contrat.assureur.estActif) return null;
  if (motifDInegibilite(contrat, maintenant) !== null) return null;

  // Ce que l'assureur a deja pris cette annee sur ce contrat. Les ventes
  // annulees ne comptent pas : une erreur de caisse corrigee ne doit pas
  // entamer le plafond du patient.
  const debutAnnee = new Date(maintenant.getFullYear(), 0, 1);
  const consomme = await prisma.venteComptoir.aggregate({
    where: { idContratAssurance: contrat.id, statut: 'PAYEE', creeLe: { gte: debutAnnee } },
    _sum: { montantAssureGnf: true },
  });

  const prise = calculerPriseEnCharge(
    lignes,
    contrat,
    contrat.assureur.regles,
    consomme._sum.montantAssureGnf ?? 0,
    montantNetGnf,
    maintenant
  );

  return {
    ...prise,
    idContrat: contrat.id,
    assureur: { id: contrat.assureur.id, nom: contrat.assureur.nom, code: contrat.assureur.code },
  };
}

// ── Administration des assureurs, de leurs regles et des contrats ────
//
// Saisie par l'administration tant que les echanges automatiques avec les
// assureurs (modes PORTAIL et API, EF-09-02) ne sont pas conventionnes.

type AssureurAvecInclude = {
  id: string; nom: string; code: string; telephone: string | null; email: string | null;
  estActif: boolean; modeEchange: ModeEchangeAssureur;
  regles: {
    id: string; categorie: CategorieProduit; exclu: boolean;
    tauxPourcent: number | null; plafondLigneGnf: number; dateEffet: Date;
  }[];
  _count: { contrats: number };
};

const ASSUREUR_INCLUDE = {
  regles: { orderBy: [{ categorie: 'asc' }, { dateEffet: 'desc' }] },
  _count: { select: { contrats: true } },
} satisfies Prisma.AssureurInclude;

function versAssureurView(a: AssureurAvecInclude): AssureurView {
  return {
    id: a.id, nom: a.nom, code: a.code,
    telephone: a.telephone, email: a.email,
    estActif: a.estActif, modeEchange: a.modeEchange,
    nombreContrats: a._count.contrats,
    regles: a.regles.map((r) => ({
      id: r.id, categorie: r.categorie, exclu: r.exclu,
      tauxPourcent: r.tauxPourcent, plafondLigneGnf: r.plafondLigneGnf,
      dateEffet: r.dateEffet.toISOString(),
    })),
  };
}

export async function creerAssureur(dto: CreerAssureurDto): Promise<AssureurView> {
  const code = dto.code.trim().toUpperCase();
  const existant = await prisma.assureur.findUnique({ where: { code } });
  if (existant) throw new ConflictError(`Un assureur porte deja le code ${code}`);

  // Un assureur peut avoir des agents sur la plateforme. Dans ce cas sa
  // structure doit etre de type ASSURANCE, sinon ses agents heriteraient des
  // droits d'un hopital ou d'une pharmacie.
  if (dto.idStructure) {
    const s = await prisma.structureSante.findUnique({
      where: { id: dto.idStructure },
      select: { type: true },
    });
    if (!s) throw new NotFoundError('Structure non trouvee');
    if (s.type !== TypeStructure.ASSURANCE) {
      throw new ValidationError('La structure rattachee doit etre de type ASSURANCE');
    }
  }

  const cree = await prisma.assureur.create({
    data: {
      nom: dto.nom.trim(),
      code,
      telephone: dto.telephone?.trim() || null,
      email: dto.email?.trim() || null,
      modeEchange: dto.modeEchange ?? 'MANUEL',
      idStructure: dto.idStructure ?? null,
    },
    include: ASSUREUR_INCLUDE,
  });
  return versAssureurView(cree);
}

export async function listerAssureurs(): Promise<AssureurView[]> {
  const assureurs = await prisma.assureur.findMany({
    include: ASSUREUR_INCLUDE,
    orderBy: { nom: 'asc' },
  });
  return assureurs.map(versAssureurView);
}

/**
 * Ajoute une regle de couverture.
 *
 * On n'ecrase pas la precedente : chaque regle porte sa date d'effet, et le
 * calcul retient celle en vigueur a la date de la vente. Changer un taux ne
 * doit pas reecrire ce qui a deja ete chiffre (EF-09-03).
 */
export async function ajouterRegle(
  idAssureur: string,
  dto: CreerRegleCouvertureDto
): Promise<AssureurView> {
  const assureur = await prisma.assureur.findUnique({
    where: { id: idAssureur },
    select: { id: true },
  });
  if (!assureur) throw new NotFoundError('Assureur non trouve');

  const exclu = dto.exclu ?? false;
  if (exclu && dto.tauxPourcent !== undefined) {
    throw new ValidationError("Une categorie exclue n'a pas de taux : choisissez l'un ou l'autre");
  }
  if (!exclu && dto.tauxPourcent === undefined && (dto.plafondLigneGnf ?? 0) === 0) {
    throw new ValidationError('Une regle doit porter une exclusion, un taux ou un plafond');
  }

  await prisma.regleCouverture.create({
    data: {
      categorie: dto.categorie,
      exclu,
      tauxPourcent: exclu ? null : dto.tauxPourcent ?? null,
      plafondLigneGnf: dto.plafondLigneGnf ?? 0,
      dateEffet: dto.dateEffet ? new Date(dto.dateEffet) : new Date(),
      idAssureur,
    },
  });

  const apres = await prisma.assureur.findUniqueOrThrow({
    where: { id: idAssureur },
    include: ASSUREUR_INCLUDE,
  });
  return versAssureurView(apres);
}

export async function creerContrat(dto: CreerContratDto): Promise<ContratAssuranceView> {
  const [assureur, patient] = await Promise.all([
    prisma.assureur.findUnique({ where: { id: dto.idAssureur }, select: { id: true, nom: true, code: true } }),
    prisma.patientProfile.findUnique({
      where: { id: dto.idPatient },
      select: { id: true, utilisateur: { select: { prenom: true, nom: true } } },
    }),
  ]);
  if (!assureur) throw new NotFoundError('Assureur non trouve');
  if (!patient) throw new NotFoundError('Patient non trouve');

  const dateEffet = new Date(dto.dateEffet);
  if (Number.isNaN(dateEffet.getTime())) throw new ValidationError("Date d'effet invalide");
  const dateFin = dto.dateFin ? new Date(dto.dateFin) : null;
  if (dateFin && dateFin <= dateEffet) {
    throw new ValidationError("La date de fin doit etre posterieure a la date d'effet");
  }

  const numeroPolice = dto.numeroPolice.trim();
  const doublon = await prisma.contratAssurance.findFirst({
    where: { idAssureur: dto.idAssureur, numeroPolice },
    select: { id: true },
  });
  if (doublon) throw new ConflictError(`La police ${numeroPolice} existe deja chez cet assureur`);

  const cree = await prisma.contratAssurance.create({
    data: {
      numeroPolice,
      tauxBasePourcent: dto.tauxBasePourcent ?? 80,
      plafondAnnuelGnf: dto.plafondAnnuelGnf ?? 0,
      franchiseGnf: dto.franchiseGnf ?? 0,
      dateEffet,
      dateFin,
      carenceJours: dto.carenceJours ?? 0,
      idAssureur: dto.idAssureur,
      idPatient: dto.idPatient,
    },
  });

  return {
    id: cree.id,
    numeroPolice: cree.numeroPolice,
    tauxBasePourcent: cree.tauxBasePourcent,
    plafondAnnuelGnf: cree.plafondAnnuelGnf,
    franchiseGnf: cree.franchiseGnf,
    dateEffet: cree.dateEffet.toISOString(),
    dateFin: cree.dateFin ? cree.dateFin.toISOString() : null,
    carenceJours: cree.carenceJours,
    statut: cree.statut,
    assureur,
    patient: { id: patient.id, prenom: patient.utilisateur.prenom, nom: patient.utilisateur.nom },
    consommeAnneeGnf: 0,
  };
}

/** Les contrats d'un patient, avec ce qui a deja ete consomme cette annee. */
export async function contratsDuPatient(
  idPatient: string,
  maintenant = new Date()
): Promise<ContratAssuranceView[]> {
  const contrats = await prisma.contratAssurance.findMany({
    where: { idPatient },
    include: {
      assureur: { select: { id: true, nom: true, code: true } },
      patient: { select: { id: true, utilisateur: { select: { prenom: true, nom: true } } } },
    },
    orderBy: { dateEffet: 'desc' },
  });

  const debutAnnee = new Date(maintenant.getFullYear(), 0, 1);
  return Promise.all(contrats.map(async (c) => {
    const consomme = await prisma.venteComptoir.aggregate({
      where: { idContratAssurance: c.id, statut: 'PAYEE', creeLe: { gte: debutAnnee } },
      _sum: { montantAssureGnf: true },
    });
    return {
      id: c.id,
      numeroPolice: c.numeroPolice,
      tauxBasePourcent: c.tauxBasePourcent,
      plafondAnnuelGnf: c.plafondAnnuelGnf,
      franchiseGnf: c.franchiseGnf,
      dateEffet: c.dateEffet.toISOString(),
      dateFin: c.dateFin ? c.dateFin.toISOString() : null,
      carenceJours: c.carenceJours,
      statut: c.statut,
      assureur: c.assureur,
      patient: { id: c.patient.id, prenom: c.patient.utilisateur.prenom, nom: c.patient.utilisateur.nom },
      consommeAnneeGnf: consomme._sum.montantAssureGnf ?? 0,
    };
  }));
}

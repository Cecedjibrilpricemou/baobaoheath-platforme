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
import { CategorieProduit, ModeEchangeAssureur, NiveauIdentite, Prisma, StatutContrat, TypeStructure } from '../config/generated/client/client';
import { prisma } from '../config/prisma';
import { filtreRecherchePatient } from './hopital.service';
import { genererMotDePasseTemp } from './admin-structure.service';
import { hashPassword } from '../utils/password.utils';
import { JwtPayload } from '../types/auth.types';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/app-error';
import { logger } from '../config/logger';
import type {
  AgentAssureurCreeView,
  AssureView,
  AssureurView,
  CreerReglementDto,
  MonAssureurView,
  PatientContratRechercheView,
  ReglementView,
  SituationPharmacieView,
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
  date: Date,
  // **Sans valeur par defaut, volontairement.** Un `= VERIFIEE` laissait tout
  // appelant qui l'oubliait contourner le verrou en silence — et le compte de
  // tests restait vert, ce qui est exactement le genre de faute qu'on ne voit
  // pas. Un garde-fou doit echouer ferme. En le rendant obligatoire, c'est le
  // compilateur qui force chaque appelant a trancher.
  identite: NiveauIdentite
): string | null {
  // **Le verrou d'identito-vigilance (EF-01-10).** Le tiers payant engage un
  // tiers : si l'identite est la mauvaise, c'est l'assureur qui paie pour
  // quelqu'un d'autre, et le vrai titulaire qui voit son plafond annuel
  // consomme sans le savoir.
  //
  // Ce verrou ne refuse **pas les soins** : le patient est servi, et paie
  // comptant. Il refuse seulement de faire payer un tiers sur une identite
  // declaree. Un agent d'accueil leve le verrou en verifiant une piece, ce
  // qui prend une minute — c'est le prix de l'engagement.
  if (identite === NiveauIdentite.PROVISOIRE) {
    return "Identite provisoire : le tiers payant demande une identite verifiee. Presentez une piece a l'accueil.";
  }

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
    select: {
      id: true,
      // Le tiers payant engage un tiers : il demande une identite verifiee.
      niveauIdentite: true,
      utilisateur: { select: { prenom: true, nom: true } },
    },
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
    motif = motifDInegibilite(contrat, maintenant, patient.niveauIdentite);
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
      // Le niveau d'identite est lu ici aussi, et pas seulement a la
      // verification d'eligibilite : sans cela le verrou se contournerait en
      // passant directement a l'encaissement.
      patient: { select: { niveauIdentite: true } },
    },
    orderBy: { dateEffet: 'desc' },
  });
  if (!contrat || !contrat.assureur.estActif) return null;
  if (motifDInegibilite(contrat, maintenant, contrat.patient.niveauIdentite) !== null) return null;

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

/**
 * Trouver la personne a qui rattacher une police (point 5.2).
 *
 * **L'administration nationale n'a pas le QR du patient sous les yeux.** Au
 * comptoir le patient est la et scanne ; ici l'assureur envoie une liste de
 * noms et de numeros de police, et c'est sur ces noms qu'il faut retomber.
 *
 * Le predicat est celui du comptoir (`filtreRecherchePatient`) : un patient
 * trouvable a l'admission doit l'etre ici, sinon sa police reste en suspens.
 *
 * **Rien de medical ne sort d'ici** : l'identite, et le numero masque comme
 * partout ailleurs. Il sert a distinguer deux Camara, pas a appeler qui que
 * ce soit.
 */
export async function rechercherPatientsPourContrat(q: string): Promise<PatientContratRechercheView[]> {
  const terme = q.trim();
  if (terme.length < 3) throw new ValidationError('Saisissez au moins 3 caracteres');

  const patients = await prisma.patientProfile.findMany({
    where: filtreRecherchePatient(terme),
    select: {
      id: true, sexe: true, dateNaissance: true, prefecture: true,
      utilisateur: { select: { prenom: true, nom: true, telephone: true } },
    },
    orderBy: [{ utilisateur: { nom: 'asc' } }, { utilisateur: { prenom: 'asc' } }],
    take: 20,
  });

  return patients.map((p) => ({
    id: p.id,
    prenom: p.utilisateur.prenom,
    nom: p.utilisateur.nom,
    sexe: p.sexe,
    dateNaissance: p.dateNaissance,
    prefecture: p.prefecture,
    telephoneMasque: p.utilisateur.telephone.replace(/.(?=.{3})/g, String.fromCharCode(8226)),
  }));
}

// ═══════════════════════════════════════════════════════════════════
// L'espace de l'assureur (addendum du 2026-09-28, point 5.2)
//
// **Rien de medical ne sort d'ici.** L'assureur voit qui est assure chez lui,
// ce que sa compagnie a pris en charge et dans quelles pharmacies — jamais un
// produit delivre, une ordonnance ni un diagnostic. Un assureur qui lirait ce
// qu'on soigne pourrait refuser un contrat dessus.
//
// Tout est donc agrege : des montants et des comptes, pas des lignes de
// vente. Le decompte detaille, s'il devient necessaire, releve de l'echange
// conventionne avec la compagnie (EF-09-02).
// ═══════════════════════════════════════════════════════════════════

/**
 * La compagnie de l'agent connecte.
 *
 * **Elle se deduit de sa structure, jamais d'un identifiant qu'il enverrait.**
 * Accepter un `idAssureur` en parametre laisserait un agent de la SONAG
 * demander la situation d'un concurrent en changeant un chiffre dans l'URL.
 */
export async function assureurDe(user: JwtPayload): Promise<{ id: string }> {
  const agent = await prisma.utilisateur.findUnique({
    where: { id: user.userId },
    select: { idStructure: true },
  });
  if (!agent?.idStructure) {
    throw new ForbiddenError('Aucune compagnie rattachee a ce compte');
  }

  const assureur = await prisma.assureur.findUnique({
    where: { idStructure: agent.idStructure },
    select: { id: true },
  });
  if (!assureur) {
    // Le compte existe, sa structure aussi, mais aucune compagnie n'y est
    // rattachee : c'est une erreur de configuration, et le dire evite de
    // chercher du cote des droits.
    throw new ForbiddenError(
      "Cette structure n'est rattachee a aucune compagnie d'assurance",
    );
  }
  return assureur;
}

export async function monAssureur(user: JwtPayload): Promise<MonAssureurView> {
  const { id } = await assureurDe(user);
  const a = await prisma.assureur.findUniqueOrThrow({
    where: { id },
    select: {
      id: true, nom: true, code: true, estActif: true, modeEchange: true,
      regles: {
        select: { id: true, categorie: true, exclu: true, tauxPourcent: true, plafondLigneGnf: true, dateEffet: true },
        orderBy: [{ categorie: 'asc' }, { dateEffet: 'desc' }],
      },
      _count: { select: { contrats: true } },
    },
  });

  return {
    id: a.id,
    nom: a.nom,
    code: a.code,
    estActif: a.estActif,
    modeEchange: a.modeEchange,
    regles: a.regles,
    nombreContrats: a._count.contrats,
    nombreContratsActifs: await prisma.contratAssurance.count({
      where: { idAssureur: id, statut: StatutContrat.ACTIF },
    }),
  };
}

/**
 * Les assures de la compagnie, et ce qu'elle a pris en charge cette annee.
 *
 * Le nom du patient y figure : c'est la personne que la compagnie assure, elle
 * la connait deja par son contrat. Son telephone, son adresse et sa date de
 * naissance, non — ils ne servent a rien ici.
 */
export async function mesAssures(user: JwtPayload): Promise<AssureView[]> {
  const { id } = await assureurDe(user);
  const debutAnnee = new Date(new Date().getFullYear(), 0, 1);

  const contrats = await prisma.contratAssurance.findMany({
    where: { idAssureur: id },
    select: {
      id: true, numeroPolice: true, statut: true, tauxBasePourcent: true,
      plafondAnnuelGnf: true, franchiseGnf: true, dateEffet: true, dateFin: true,
      patient: { select: { utilisateur: { select: { prenom: true, nom: true } } } },
    },
    orderBy: [{ statut: 'asc' }, { dateEffet: 'desc' }],
  });
  if (contrats.length === 0) return [];

  // Une seule agregation groupee plutot qu'une requete par contrat : une
  // compagnie peut avoir des milliers d'assures.
  const consommations = await prisma.venteComptoir.groupBy({
    by: ['idContratAssurance'],
    where: {
      idContratAssurance: { in: contrats.map((c) => c.id) },
      statut: 'PAYEE',
      creeLe: { gte: debutAnnee },
    },
    _sum: { montantAssureGnf: true },
    _count: { _all: true },
  });
  const parContrat = new Map(consommations.map((c) => [c.idContratAssurance, c]));

  return contrats.map((c) => {
    const conso = parContrat.get(c.id);
    return {
      idContrat: c.id,
      numeroPolice: c.numeroPolice,
      statut: c.statut,
      tauxBasePourcent: c.tauxBasePourcent,
      plafondAnnuelGnf: c.plafondAnnuelGnf,
      franchiseGnf: c.franchiseGnf,
      dateEffet: c.dateEffet,
      dateFin: c.dateFin,
      patient: { prenom: c.patient.utilisateur.prenom, nom: c.patient.utilisateur.nom },
      consommeAnneeGnf: conso?._sum.montantAssureGnf ?? 0,
      nombrePassages: conso?._count._all ?? 0,
    };
  });
}

/**
 * La situation par officine (point 5.2) : « ce qui a ete delivre, ce qui lui
 * est facture, ce qui est paye, ce qui reste du, et les ecarts ».
 *
 * Les ventes annulees ne comptent nulle part : une erreur de caisse corrigee
 * ne doit ni gonfler ce que la compagnie doit, ni entamer le plafond d'un
 * assure.
 */
export async function mesPharmacies(user: JwtPayload): Promise<SituationPharmacieView[]> {
  const { id } = await assureurDe(user);

  const ventes = await prisma.venteComptoir.groupBy({
    by: ['idStructure'],
    where: { contratAssurance: { idAssureur: id }, statut: 'PAYEE' },
    _sum: { montantAssureGnf: true, montantNetGnf: true },
    _count: { _all: true },
  });

  const reglements = await prisma.reglementAssureur.groupBy({
    by: ['idStructure'],
    where: { idAssureur: id },
    _sum: { montantGnf: true },
    _max: { creeLe: true },
  });

  // Une officine peut avoir ete reglee sans vente sur la periode retenue, ou
  // avoir vendu sans avoir encore ete reglee : les deux cotes comptent.
  const idsStructures = [...new Set([
    ...ventes.map((v) => v.idStructure),
    ...reglements.map((r) => r.idStructure),
  ])];
  if (idsStructures.length === 0) return [];

  const structures = await prisma.structureSante.findMany({
    where: { id: { in: idsStructures } },
    select: { id: true, nom: true, prefecture: true },
  });
  const parVente = new Map(ventes.map((v) => [v.idStructure, v]));
  const parReglement = new Map(reglements.map((r) => [r.idStructure, r]));

  return structures
    .map((s) => {
      const v = parVente.get(s.id);
      const r = parReglement.get(s.id);
      const facture = v?._sum.montantAssureGnf ?? 0;
      const paye = r?._sum.montantGnf ?? 0;
      return {
        idStructure: s.id,
        nom: s.nom,
        prefecture: s.prefecture,
        nombreVentes: v?._count._all ?? 0,
        montantDelivreGnf: v?._sum.montantNetGnf ?? 0,
        montantFactureGnf: facture,
        montantPayeGnf: paye,
        resteDuGnf: facture - paye,
        dernierReglementLe: r?._max.creeLe ?? null,
      };
    })
    // Le plus gros reste du en tete : c'est ce qu'on vient regarder.
    .sort((a, b) => b.resteDuGnf - a.resteDuGnf);
}

/**
 * Enregistrer un versement a une officine.
 *
 * Le versement couvre une periode et non des ventes nommees : c'est ainsi
 * qu'une compagnie regle une pharmacie, par bordereau. Rattacher chaque
 * virement a des lignes supposerait un rapprochement que personne ne fait.
 */
export async function enregistrerReglement(
  user: JwtPayload,
  dto: CreerReglementDto,
): Promise<ReglementView> {
  const { id: idAssureur } = await assureurDe(user);

  const structure = await prisma.structureSante.findUnique({
    where: { id: dto.idStructure },
    select: { id: true, nom: true, type: true },
  });
  // On regle une officine, pas un hopital : l'erreur de destinataire est
  // silencieuse autrement, et fausse la situation des deux cotes.
  if (!structure || structure.type !== TypeStructure.PHARMACIE) {
    throw new NotFoundError('Pharmacie introuvable');
  }

  const debut = new Date(dto.periodeDebut);
  const fin = new Date(dto.periodeFin);
  if (fin < debut) {
    throw new ValidationError('La fin de periode precede son debut');
  }
  if (dto.montantGnf <= 0) {
    throw new ValidationError('Le montant verse doit etre positif');
  }

  const r = await prisma.reglementAssureur.create({
    data: {
      idAssureur,
      idStructure: structure.id,
      montantGnf: dto.montantGnf,
      periodeDebut: debut,
      periodeFin: fin,
      reference: dto.reference?.trim() || null,
      idSaisiPar: user.userId,
    },
    select: {
      id: true, montantGnf: true, periodeDebut: true, periodeFin: true,
      reference: true, creeLe: true,
      structure: { select: { id: true, nom: true } },
      saisiPar: { select: { prenom: true, nom: true } },
    },
  });

  logger.info('[ASSURANCE] reglement enregistre', {
    idAssureur, idStructure: structure.id, montantGnf: dto.montantGnf, parQui: user.userId,
  });
  return r;
}

/** Les versements de la compagnie, le plus recent en tete. */
export async function mesReglements(user: JwtPayload): Promise<ReglementView[]> {
  const { id } = await assureurDe(user);
  return prisma.reglementAssureur.findMany({
    where: { idAssureur: id },
    select: {
      id: true, montantGnf: true, periodeDebut: true, periodeFin: true,
      reference: true, creeLe: true,
      structure: { select: { id: true, nom: true } },
      saisiPar: { select: { prenom: true, nom: true } },
    },
    orderBy: { creeLe: 'desc' },
    take: 100,
  });
}

/**
 * Creer le compte par lequel un assureur se connecte (addendum, point 5.2).
 *
 * **L'assureur n'appartient a aucun hopital.** Ses agents se connectent depuis
 * une structure de type ASSURANCE qui lui est propre — sans elle, ils
 * heriteraient des droits d'une pharmacie ou d'un etablissement de soins, et
 * donc d'un acces aux dossiers.
 *
 * La structure est creee a la volee si la compagnie n'en a pas : demander a
 * l'administration de declarer d'abord un « etablissement de sante » pour une
 * compagnie d'assurance n'aurait aucun sens a l'ecran, alors que le modele,
 * lui, en a besoin.
 *
 * Le mot de passe n'est rendu qu'une fois, et devra etre change.
 */
export async function creerAgentAssureur(
  auteur: JwtPayload,
  idAssureur: string,
  dto: { prenom: string; nom: string; telephone: string; email?: string; prefecture?: string },
): Promise<AgentAssureurCreeView> {
  const assureur = await prisma.assureur.findUnique({
    where: { id: idAssureur },
    select: { id: true, nom: true, code: true, idStructure: true },
  });
  if (!assureur) throw new NotFoundError('Assureur introuvable');

  const existant = await prisma.utilisateur.findUnique({
    where: { telephone: dto.telephone },
    select: { prenom: true, nom: true },
  });
  if (existant) {
    throw new ConflictError(
      `Ce numero appartient deja a ${existant.prenom} ${existant.nom}.`,
    );
  }

  const motDePasseTemporaire = genererMotDePasseTemp();
  const motDePasseHash = await hashPassword(motDePasseTemporaire);

  const agent = await prisma.$transaction(async (tx) => {
    let idStructure = assureur.idStructure;
    if (!idStructure) {
      const s = await tx.structureSante.create({
        data: {
          nom: assureur.nom,
          type: TypeStructure.ASSURANCE,
          // Faute de mieux : une compagnie n'a pas de prefecture au modele, et
          // la colonne est obligatoire. Conakry est le siege par defaut.
          prefecture: dto.prefecture?.trim() || 'Conakry',
        },
        select: { id: true },
      });
      idStructure = s.id;
      await tx.assureur.update({ where: { id: assureur.id }, data: { idStructure } });
    }

    return tx.utilisateur.create({
      data: {
        telephone: dto.telephone.trim(),
        email: dto.email?.trim() || null,
        motDePasseHash,
        prenom: dto.prenom.trim(),
        nom: dto.nom.trim(),
        role: 'ASSUREUR',
        idStructure,
        estActif: true,
        doitChangerMotDePasse: true,
      },
      select: { id: true, prenom: true, nom: true, telephone: true },
    });
  });

  logger.info('[ASSURANCE] compte agent assureur cree', {
    idAssureur: assureur.id, idAgent: agent.id, parQui: auteur.userId,
  });

  return {
    agent,
    assureur: { id: assureur.id, nom: assureur.nom, code: assureur.code },
    motDePasseTemporaire,
  };
}

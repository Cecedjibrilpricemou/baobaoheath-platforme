// src/services/vente.service.ts
//
// Vente au comptoir et tableau de bord d'officine (addendum du 2026-09-28,
// points 1.1 et 1.2).
//
// Pourquoi un modele a part plutot qu'une `Facture` elargie : `Facture` est la
// note d'une consultation. Elle n'a aucune ligne — donc elle ne sait pas dire
// ce qui a ete vendu — elle exige un patient, alors qu'un passant n'a pas de
// dossier, et elle ne porte ni vendeur, ni remise, ni etablissement. Lui
// ajouter tout cela aurait rendu ambigue chaque requete existante.
//
// La sortie de stock passe par `consommerLots` : au plus proche de la
// peremption, lot perime refuse. Ce service ne la reecrit pas.
import { randomUUID } from 'crypto';
import { Prisma, StatutVente, TypeStructure } from '../config/generated/client/client';
import { prisma } from '../config/prisma';
import * as chapchap from './chapchap.service';
import { logger } from '../config/logger';
import { JwtPayload } from '../types/auth.types';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/app-error';
import { consommerLots, peremptionLaPlusProche } from './approvisionnement.service';
import { chiffrer, type LigneAChiffrer } from './assurance.service';
import { prochainNumero } from './numero.service';
import { motifDeRefus, renouvellementsRestants } from './ordonnance.service';
import { getValeursParametres } from './parametres.service';
import type {
  AnnulerVenteDto,
  CreerVenteDto,
  LigneVenteDto,
  ProduitVenduView,
  RuptureStockView,
  TableauDeBordOfficineView,
  VenteComptoirView,
} from '@baobaoheath/shared-types';

/** Seuil d'alerte sur les peremptions, aligne sur `approvisionnement.service`. */
const PEREMPTION_ALERTE_JOURS = Number(process.env.STOCK_PEREMPTION_ALERTE_JOURS ?? 90);

/** Les lots qu'une ligne a consommes, telle qu'ils sont ranges en JSON. */
type LotConsomme = { idLot: string; quantite: number };

const VENTE_INCLUDE = {
  vendeur: { select: { id: true, prenom: true, nom: true } },
  patient: { select: { id: true, utilisateur: { select: { prenom: true, nom: true } } } },
  ordonnance: { select: { numero: true } },
  contratAssurance: { select: { assureur: { select: { id: true, nom: true, code: true } } } },
  lignes: {
    include: {
      medicament: {
        select: { id: true, libelle: true, categorie: true, dci: true, nomCommercial: true, dosage: true, forme: true },
      },
    },
    orderBy: { id: 'asc' },
  },
} satisfies Prisma.VenteComptoirInclude;

type VenteAvecInclude = Prisma.VenteComptoirGetPayload<{ include: typeof VENTE_INCLUDE }>;

function versVue(v: VenteAvecInclude): VenteComptoirView {
  return {
    id: v.id,
    numero: v.numero,
    statut: v.statut,
    montantBrutGnf: v.montantBrutGnf,
    remiseGnf: v.remiseGnf,
    montantNetGnf: v.montantNetGnf,
    montantAssureGnf: v.montantAssureGnf,
    montantPatientGnf: v.montantPatientGnf,
    assureur: v.contratAssurance
      ? {
          id: v.contratAssurance.assureur.id,
          nom: v.contratAssurance.assureur.nom,
          code: v.contratAssurance.assureur.code,
        }
      : null,
    modePaiement: v.modePaiement,
    numeroOperateur: v.numeroOperateur,
    // Le lien ne sert plus une fois la vente reglee : le rendre inviterait a
    // repayer.
    urlPaiement: v.statut === StatutVente.EN_ATTENTE ? v.urlPaiement : null,
    statutOperateur: v.statutOperateur,
    referenceTransaction: v.referenceTransaction,
    creeLe: v.creeLe.toISOString(),
    annuleeLe: v.annuleeLe ? v.annuleeLe.toISOString() : null,
    motifAnnulation: v.motifAnnulation,
    vendeur: v.vendeur,
    patient: v.patient
      ? { id: v.patient.id, prenom: v.patient.utilisateur.prenom, nom: v.patient.utilisateur.nom }
      : null,
    numeroOrdonnance: v.ordonnance?.numero ?? null,
    lignes: v.lignes.map((l) => ({
      id: l.id,
      quantite: l.quantite,
      prixUnitaireGnf: l.prixUnitaireGnf,
      montantGnf: l.montantGnf,
      medicament: l.medicament,
      // Couverture figee a la vente : relire les regles plus tard donnerait un
      // reste a charge qui change apres coup.
      couvert: l.couvert,
      tauxAppliquePourcent: l.tauxAppliquePourcent,
      montantAssureGnf: l.montantAssureGnf,
      motifExclusion: l.motifExclusion,
    })),
  };
}

/**
 * L'officine du vendeur. On verifie le type de structure : un compte
 * `PHARMACIEN` rattache par erreur a un centre de sante ne doit pas pouvoir
 * ouvrir une caisse.
 */
async function officineDe(userId: string): Promise<string> {
  const u = await prisma.utilisateur.findUnique({
    where: { id: userId },
    select: { idStructure: true, structure: { select: { type: true } } },
  });
  if (!u?.idStructure || !u.structure) throw new ForbiddenError('Aucune structure rattachee a votre compte');
  if (u.structure.type !== TypeStructure.PHARMACIE) {
    throw new ValidationError("La structure rattachee a votre compte n'est pas une pharmacie");
  }
  return u.idStructure;
}

/**
 * Fusionne les lignes qui portent le meme produit.
 *
 * Au comptoir, scanner deux fois la meme boite veut dire « quantite 2 », pas
 * « erreur ». Refuser le doublon obligerait le vendeur a corriger une saisie
 * qui est en realite correcte.
 */
export function fusionnerLignes(lignes: LigneVenteDto[]): LigneVenteDto[] {
  const parProduit = new Map<string, number>();
  for (const l of lignes) {
    if (!Number.isInteger(l.quantite) || l.quantite <= 0) {
      throw new ValidationError('Chaque ligne doit porter une quantite entiere superieure a 0');
    }
    parProduit.set(l.idMedicament, (parProduit.get(l.idMedicament) ?? 0) + l.quantite);
  }
  return [...parProduit.entries()].map(([idMedicament, quantite]) => ({ idMedicament, quantite }));
}

/**
 * Les produits du panier qui ne se vendent pas sans ordonnance : les
 * reglementes (EF-05-12, acquis) et ceux dont la categorie est soumise par
 * les parametres (question E de l'addendum, non tranchee).
 */
export function produitsExigeantOrdonnance(
  produits: { libelle: string; estReglemente: boolean; categorie: string }[],
  categoriesSoumises: readonly string[]
): string[] {
  return produits
    .filter((p) => p.estReglemente || categoriesSoumises.includes(p.categorie))
    .map((p) => p.libelle);
}

export async function creerVente(user: JwtPayload, dto: CreerVenteDto): Promise<VenteComptoirView> {
  const idStructure = await officineDe(user.userId);

  const lignes = fusionnerLignes(dto.lignes ?? []);
  if (lignes.length === 0) throw new ValidationError('Le panier est vide');

  if (dto.modePaiement !== 'ESPECES' && !dto.numeroOperateur?.trim()) {
    throw new ValidationError('Un paiement mobile exige le numero de l abonne');
  }

  /**
   * Les especes n'ont pas de passerelle : l'agent encaisse devant lui, et la
   * vente est payee a l'instant ou elle est saisie. Sans passerelle
   * configuree non plus — on retombe alors sur l'ancien comportement, qui
   * vaut mieux qu'une caisse bloquee.
   */
  const passeParLaPasserelle =
    dto.modePaiement !== 'ESPECES' && chapchap.chapchapEstConfigure();

  // Le stock de cette officine pour chaque produit du panier. Un produit
  // absent du stock n'est pas vendable ici, meme s'il existe au catalogue.
  const stocks = await prisma.stock.findMany({
    where: { idStructure, idMedicament: { in: lignes.map((l) => l.idMedicament) } },
    include: {
      medicament: {
        select: {
          id: true, libelle: true, categorie: true, estReglemente: true, prixUnitaireGnf: true,
        },
      },
    },
  });
  const parProduit = new Map(stocks.map((s) => [s.idMedicament, s]));

  const manquants = lignes.filter((l) => !parProduit.has(l.idMedicament));
  if (manquants.length > 0) {
    throw new ValidationError(`${manquants.length} produit(s) du panier ne sont pas au stock de cette officine`);
  }

  const { pharmacie } = await getValeursParametres();

  // EF-05-12 : un produit reglemente ne se vend jamais sans ordonnance.
  const exigeants = produitsExigeantOrdonnance(
    lignes.map((l) => parProduit.get(l.idMedicament)!.medicament),
    pharmacie.categoriesExigeantOrdonnance
  );
  if (exigeants.length > 0 && !dto.idOrdonnance) {
    throw new ValidationError(
      `Ordonnance obligatoire pour : ${exigeants.join(', ')}`
    );
  }

  // L'ordonnance presentee doit etre valide : les memes regles qu'au guichet
  // de delivrance, via `motifDeRefus`, pour qu'un papier refuse d'un cote ne
  // passe pas de l'autre.
  if (dto.idOrdonnance) {
    const ordonnance = await prisma.ordonnance.findUnique({
      where: { id: dto.idOrdonnance },
      include: { lignes: { include: { medicament: { select: { estReglemente: true } } } } },
    });
    if (!ordonnance) throw new NotFoundError('Ordonnance non trouvee');

    const motif = motifDeRefus(
      {
        statut: ordonnance.statut,
        signeLe: ordonnance.signeLe,
        valideJusquau: ordonnance.valideJusquau,
        contientProduitReglemente: ordonnance.lignes.some((l) => l.medicament.estReglemente),
        renouvellementsRestants: renouvellementsRestants(ordonnance),
      },
      (await getValeursParametres()).prescription.signatureObligatoire
    );
    if (motif) throw new ValidationError(`Ordonnance refusee : ${motif}`);
  }

  // Prix figes a la vente : tarif de reference plus la marge de l'officine.
  const detail = lignes.map((l) => {
    const stock = parProduit.get(l.idMedicament)!;
    const prixUnitaireGnf = stock.medicament.prixUnitaireGnf + stock.margeGnf;
    return {
      idMedicament: l.idMedicament,
      quantite: l.quantite,
      prixUnitaireGnf,
      montantGnf: prixUnitaireGnf * l.quantite,
      idStock: stock.id,
    };
  });

  const montantBrutGnf = detail.reduce((t, l) => t + l.montantGnf, 0);
  const remiseGnf = Math.trunc(dto.remiseGnf ?? 0);
  if (remiseGnf < 0) throw new ValidationError('La remise ne peut pas etre negative');

  const plafond = Math.floor((montantBrutGnf * pharmacie.remiseMaxPourcent) / 100);
  if (remiseGnf > plafond) {
    throw new ValidationError(
      `Remise plafonnee a ${pharmacie.remiseMaxPourcent} % du total, soit ${plafond} GNF`
    );
  }

  const montantNetGnf = montantBrutGnf - remiseGnf;

  // ── Tiers payant (EF-09) ─────────────────────────────────────────
  //
  // On ne couvre pas un passant anonyme : sans dossier, il n'y a pas de
  // contrat a opposer. Et sans contrat utilisable, on refuse la vente plutot
  // que d'encaisser le patient a son insu alors qu'il presente une carte.
  let prise: Awaited<ReturnType<typeof chiffrer>> = null;
  if (dto.avecAssurance) {
    if (!dto.idPatient) {
      throw new ValidationError("Le tiers payant demande un patient : un client de passage n'a pas de contrat");
    }
    const lignesAChiffrer: LigneAChiffrer[] = detail.map((l) => {
      const m = parProduit.get(l.idMedicament)!.medicament;
      return { idMedicament: l.idMedicament, libelle: m.libelle, categorie: m.categorie, montantGnf: l.montantGnf };
    });
    prise = await chiffrer(dto.idPatient, lignesAChiffrer, montantNetGnf);
    if (!prise) {
      throw new ValidationError(
        "Aucun contrat d'assurance utilisable pour ce patient : verifiez son eligibilite"
      );
    }
  }

  const couvertureParProduit = new Map(
    (prise?.lignes ?? []).map((l) => [l.idMedicament, l])
  );

  /**
   * L'operation de paiement, **avant** d'ecrire quoi que ce soit.
   *
   * Deux raisons de la placer ici plutot qu'apres la transaction :
   *
   *   - une vente inseree `EN_ATTENTE` sans operation viole l'invariant —
   *     rien ne la ferait jamais aboutir et elle bloquerait ses lots. Une
   *     contrainte SQL le refuse, et elle a eu raison du premier essai ;
   *   - un appel reseau **dans** une transaction Postgres la tiendrait
   *     ouverte le temps d'un aller-retour vers un operateur mobile, en
   *     verrouillant les lignes de stock pendant ce temps.
   *
   * Si la passerelle refuse, rien n'a ete ecrit : aucun lot a rendre. Une
   * operation ouverte sans vente expire d'elle-meme au bout de 72 heures,
   * sans qu'un franc ait bouge.
   */
  const montantPatientGnf = montantNetGnf - (prise?.montantAssureGnf ?? 0);
  let operation: Awaited<ReturnType<typeof chapchap.creerOperation>> | null = null;
  if (passeParLaPasserelle) {
    if (montantPatientGnf < MIN_PASSERELLE_GNF) {
      throw new ValidationError(
        `Le paiement mobile demande au moins ${MIN_PASSERELLE_GNF.toLocaleString('fr-FR')} GNF. `
        + `Encaissez ce montant en especes.`,
      );
    }
    operation = await chapchap.creerOperation({
      // Ce que le client paie vraiment : la part de l'assureur ne passe pas
      // par son telephone.
      montantGnf: montantPatientGnf,
      orderId: `VNT-${randomUUID()}`,
      description: 'Pharmacie — achat au comptoir',
    });
  }

  const cree = await prisma.$transaction(async (tx) => {
    const numero = await prochainNumero('VE', tx);

    const vente = await tx.venteComptoir.create({
      data: {
        numero,
        montantBrutGnf,
        remiseGnf,
        montantNetGnf,
        montantAssureGnf: prise?.montantAssureGnf ?? 0,
        montantPatientGnf: montantNetGnf - (prise?.montantAssureGnf ?? 0),
        idContratAssurance: prise?.idContrat ?? null,
        modePaiement: dto.modePaiement,
        numeroOperateur: dto.numeroOperateur?.trim() || null,
        // **Une vente mobile naît en attente.** Jusqu'au 2026-10-09 elle
        // naissait payee : le pharmacien cochait « Orange Money » et rien ne
        // verifiait qu'un franc ait bouge. Les lots sont bien consommes des
        // maintenant — on ne vend pas deux fois la derniere boite pendant que
        // le client tape son code — mais les medicaments ne se remettent
        // qu'au « success ».
        statut: operation ? 'EN_ATTENTE' : 'PAYEE',
        idOperation: operation?.operationId ?? null,
        urlPaiement: operation?.urlPaiement ?? null,
        statutOperateur: operation ? 'new' : null,
        idPatient: dto.idPatient ?? null,
        idOrdonnance: dto.idOrdonnance ?? null,
        idStructure,
        idVendeur: user.userId,
      },
    });

    for (const l of detail) {
      // `consommerLots` refuse si les lots non perimes ne suffisent pas, et
      // sort au plus proche de la date. On garde ce qu'il a consomme : c'est
      // ce qui permet d'annuler a l'identique, et de savoir quel lot est parti
      // chez qui en cas de rappel.
      const lots = await consommerLots(tx, l.idStock, l.quantite);
      await tx.stock.update({ where: { id: l.idStock }, data: { quantite: { decrement: l.quantite } } });
      const couverture = couvertureParProduit.get(l.idMedicament);
      await tx.ligneVente.create({
        data: {
          idVente: vente.id,
          idMedicament: l.idMedicament,
          quantite: l.quantite,
          prixUnitaireGnf: l.prixUnitaireGnf,
          montantGnf: l.montantGnf,
          lotsConsommes: lots as unknown as Prisma.InputJsonValue,
          // Le detail est fige : « un reste a charge sans explication se
          // conteste au comptoir » (addendum, point 5.4).
          couvert: couverture?.couvert ?? false,
          tauxAppliquePourcent: couverture?.tauxAppliquePourcent ?? 0,
          montantAssureGnf: couverture?.montantAssureGnf ?? 0,
          motifExclusion: couverture?.motifExclusion ?? null,
        },
      });
    }

    return vente.id;
  });


  const vente = await prisma.venteComptoir.findUniqueOrThrow({ where: { id: cree }, include: VENTE_INCLUDE });
  return versVue(vente);
}

/** En dessous, la passerelle refuse (verifie contre son bac a sable). */
const MIN_PASSERELLE_GNF = 3_000;

/**
 * Annule une vente et remet en stock exactement les lots qui en etaient
 * sortis.
 *
 * Ce n'est pas un retour client — EF-07-11 l'interdit — mais la correction
 * d'une erreur de saisie. Sans cette porte, une erreur de caisse ferait
 * deriver le stock de facon permanente, et le chiffre d'affaires avec lui.
 */
export async function annulerVente(
  user: JwtPayload,
  idVente: string,
  dto: AnnulerVenteDto
): Promise<VenteComptoirView> {
  const idStructure = await officineDe(user.userId);

  const motif = dto.motif?.trim() ?? '';
  if (motif.length < 5) throw new ValidationError("Le motif d'annulation doit comporter au moins 5 caracteres");

  const vente = await prisma.venteComptoir.findUnique({
    where: { id: idVente },
    select: { idStructure: true, statut: true },
  });
  if (!vente) throw new NotFoundError('Vente non trouvee');
  if (vente.idStructure !== idStructure) throw new ForbiddenError("Cette vente n'est pas celle de votre officine");
  if (vente.statut === StatutVente.ANNULEE) throw new ConflictError('Cette vente est deja annulee');

  await rendreLesLots(idVente, motif, user.userId);

  const apres = await prisma.venteComptoir.findUniqueOrThrow({ where: { id: idVente }, include: VENTE_INCLUDE });
  return versVue(apres);
}

/**
 * Annule une vente et remet exactement les lots qui en etaient sortis.
 *
 * **Extrait pour etre partage.** Deux chemins y menent : l'agent qui corrige
 * une erreur de saisie, et un paiement mobile qui n'aboutit pas. Deux copies
 * de cette logique voudraient dire qu'une correction n'en repare qu'une, et
 * le stock deriverait par l'autre.
 *
 * `EN_ATTENTE` compte autant que `PAYEE` dans la prise atomique : une vente
 * dont le client est parti sans payer doit rendre ses boites, sinon elles
 * resteraient sorties du stock sans que rien ne les y ramene.
 */
async function rendreLesLots(idVente: string, motif: string, idAuteur: string): Promise<void> {
  const vente = await prisma.venteComptoir.findUniqueOrThrow({
    where: { id: idVente },
    select: {
      idStructure: true,
      lignes: { select: { quantite: true, idMedicament: true, lotsConsommes: true } },
    },
  });

  await prisma.$transaction(async (tx) => {
    // Prise atomique : deux annulations simultanees donnent une gagnante et
    // une perdante, jamais deux remises en stock.
    const prise = await tx.venteComptoir.updateMany({
      where: { id: idVente, statut: { in: [StatutVente.PAYEE, StatutVente.EN_ATTENTE] } },
      data: {
        statut: StatutVente.ANNULEE,
        annuleeLe: new Date(),
        motifAnnulation: motif,
        idAnnuleePar: idAuteur,
      },
    });
    if (prise.count === 0) throw new ConflictError('Cette vente vient d etre annulee par quelqu un d autre');

    for (const ligne of vente.lignes) {
      const lots = (ligne.lotsConsommes ?? []) as unknown as LotConsomme[];
      for (const lot of lots) {
        await tx.lotStock.update({
          where: { id: lot.idLot },
          data: { quantite: { increment: lot.quantite } },
        });
      }
      // Le stock total suit la somme de ses lots.
      const remis = lots.reduce((t, l) => t + l.quantite, 0);
      if (remis > 0) {
        await tx.stock.updateMany({
          where: { idStructure: vente.idStructure, idMedicament: ligne.idMedicament },
          data: { quantite: { increment: remis } },
        });
      }
    }
  });
}

/** Les ventes de l'officine, de la plus recente a la plus ancienne. */
export async function listerVentes(user: JwtPayload, limite = 50): Promise<VenteComptoirView[]> {
  const idStructure = await officineDe(user.userId);
  const ventes = await prisma.venteComptoir.findMany({
    where: { idStructure },
    include: VENTE_INCLUDE,
    orderBy: { creeLe: 'desc' },
    take: Math.min(Math.max(limite, 1), 200),
  });
  return ventes.map(versVue);
}

export async function getVente(user: JwtPayload, idVente: string): Promise<VenteComptoirView> {
  const idStructure = await officineDe(user.userId);
  const vente = await prisma.venteComptoir.findUnique({ where: { id: idVente }, include: VENTE_INCLUDE });
  if (!vente) throw new NotFoundError('Vente non trouvee');
  if (vente.idStructure !== idStructure) throw new ForbiddenError("Cette vente n'est pas celle de votre officine");
  return versVue(vente);
}

/** Minuit du jour courant, au fuseau du serveur. */
function debutDuJour(maintenant = new Date()): Date {
  const d = new Date(maintenant);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function tableauDeBord(user: JwtPayload, maintenant = new Date()): Promise<TableauDeBordOfficineView> {
  const idStructure = await officineDe(user.userId);
  const jour = debutDuJour(maintenant);
  const ilYATrenteJours = new Date(maintenant.getTime() - 30 * 86_400_000);

  // Les ventes annulees sont exclues partout : une erreur de caisse corrigee
  // ne doit pas gonfler le chiffre d'affaires.
  const duJour = { idStructure, statut: StatutVente.PAYEE, creeLe: { gte: jour } };

  const [agregatJour, parMode, topLignes, ruptures, lotsAPerimer] = await Promise.all([
    prisma.venteComptoir.aggregate({ where: duJour, _sum: { montantNetGnf: true }, _count: true }),
    prisma.venteComptoir.groupBy({
      by: ['modePaiement'],
      where: duJour,
      _sum: { montantNetGnf: true },
      _count: true,
    }),
    prisma.ligneVente.groupBy({
      by: ['idMedicament'],
      where: { vente: { idStructure, statut: StatutVente.PAYEE, creeLe: { gte: ilYATrenteJours } } },
      _sum: { quantite: true, montantGnf: true },
      orderBy: { _sum: { quantite: 'desc' } },
      take: 10,
    }),
    prisma.stock.findMany({
      where: { idStructure, quantite: { lte: prisma.stock.fields.seuilAlerte } },
      include: {
        medicament: {
          select: { id: true, libelle: true, categorie: true, dci: true, nomCommercial: true, dosage: true, forme: true },
        },
      },
      orderBy: { quantite: 'asc' },
      take: 20,
    }),
    prisma.lotStock.count({
      where: {
        quantite: { gt: 0 },
        datePeremption: { not: null, lte: new Date(maintenant.getTime() + PEREMPTION_ALERTE_JOURS * 86_400_000) },
        stock: { idStructure },
      },
    }),
  ]);

  const chiffreDuJourGnf = agregatJour._sum.montantNetGnf ?? 0;
  const nombreVentesDuJour = agregatJour._count;

  // Les libelles des produits du classement, en une requete plutot qu'une par
  // ligne.
  const produits = await prisma.medicament.findMany({
    where: { id: { in: topLignes.map((l) => l.idMedicament) } },
    select: { id: true, libelle: true, categorie: true, dci: true, nomCommercial: true, dosage: true, forme: true },
  });
  const parId = new Map(produits.map((p) => [p.id, p]));

  const produitsLesPlusVendus: ProduitVenduView[] = topLignes.flatMap((l) => {
    const medicament = parId.get(l.idMedicament);
    if (!medicament) return [];
    return [{
      medicament,
      quantite: l._sum.quantite ?? 0,
      montantGnf: l._sum.montantGnf ?? 0,
    }];
  });

  const vuesRuptures: RuptureStockView[] = ruptures.map((s) => ({
    medicament: s.medicament,
    quantite: s.quantite,
    seuilAlerte: s.seuilAlerte,
    unite: s.unite,
  }));

  return {
    jour: jour.toISOString(),
    chiffreDuJourGnf,
    nombreVentesDuJour,
    // Division entiere : un panier moyen au franc pres suffit, et il n'y a pas
    // de centime de franc guineen.
    panierMoyenGnf: nombreVentesDuJour > 0 ? Math.round(chiffreDuJourGnf / nombreVentesDuJour) : 0,
    encaissementsParMode: parMode.map((m) => ({
      modePaiement: m.modePaiement,
      montantGnf: m._sum.montantNetGnf ?? 0,
      nombre: m._count,
    })),
    produitsLesPlusVendus,
    ruptures: vuesRuptures,
    lotsAPerimer,
  };
}

// `peremptionLaPlusProche` est reexporte pour que l'ecran de caisse puisse
// afficher la date du lot qui sortira, sans dupliquer le calcul.
export { peremptionLaPlusProche };

/**
 * Relit le paiement d'une vente en attente, et la regle s'il a abouti.
 *
 * **C'est la relecture qui tranche, pas le rappel.** Un webhook peut ne
 * jamais arriver — URL injoignable, serveur redemarre, developpement en
 * local. Au comptoir, le pharmacien a le client devant lui : il appuie sur
 * « verifier » et doit obtenir une reponse immediate.
 *
 * Point unique avec le rappel : deux chemins qui decideraient separement
 * finiraient par diverger, et c'est de l'argent.
 */
export async function appliquerPaiementVente(
  idVente: string,
  statut: string,
  details?: { referenceTransaction?: string | null },
): Promise<{ changee: boolean; dejaPayee: boolean }> {
  const vente = await prisma.venteComptoir.findUnique({
    where: { id: idVente },
    select: { id: true, statut: true, statutOperateur: true, idOperation: true },
  });
  if (!vente) throw new NotFoundError('Vente non trouvee');

  // Un paiement acquis ne redescend jamais : plusieurs rappels portent la
  // meme operation, et dans n'importe quel ordre.
  if (vente.statut === StatutVente.PAYEE) return { changee: false, dejaPayee: true };
  if (vente.statut === StatutVente.ANNULEE) return { changee: false, dejaPayee: false };

  if (!chapchap.estPaye(statut)) {
    if (vente.statutOperateur === statut) return { changee: false, dejaPayee: false };
    await prisma.venteComptoir.update({ where: { id: idVente }, data: { statutOperateur: statut } });
    return { changee: true, dejaPayee: false };
  }

  // La contrainte SQL refuse une vente payee par operation sans reference :
  // a defaut, on garde l'identifiant de l'operation, qui reste opposable.
  const reference = details?.referenceTransaction?.trim() || vente.idOperation;
  const prise = await prisma.venteComptoir.updateMany({
    where: { id: idVente, statut: StatutVente.EN_ATTENTE },
    data: { statut: StatutVente.PAYEE, statutOperateur: statut, referenceTransaction: reference },
  });
  return { changee: prise.count > 0, dejaPayee: prise.count === 0 };
}

/**
 * Applique un statut a la vente portant cette operation.
 *
 * **Le rappel ne connait pas notre identifiant de vente.** L'operation est
 * ouverte avant que la vente n'existe — il le faut, sinon la vente naîtrait
 * en attente sans operation et violerait son invariant. Le `order_id` envoye
 * a la passerelle ne peut donc pas porter l'identifiant de la vente :
 * `idOperation`, unique, est la cle qui les relie.
 */
export async function appliquerPaiementParOperation(
  idOperation: string,
  statut: string,
  details?: { referenceTransaction?: string | null },
): Promise<{ changee: boolean; dejaPayee: boolean }> {
  const vente = await prisma.venteComptoir.findUnique({
    where: { idOperation },
    select: { id: true },
  });
  if (!vente) throw new NotFoundError('Vente non trouvee');
  return appliquerPaiementVente(vente.id, statut, details);
}

/**
 * Ce que la caisse appelle pour savoir ou en est le client.
 *
 * Elle interroge la passerelle quand l'issue n'est pas connue : c'est le
 * geste du pharmacien qui attend, pas une tache de fond.
 */
export async function rafraichirPaiementVente(
  user: JwtPayload,
  idVente: string,
): Promise<VenteComptoirView> {
  const idStructure = await officineDe(user.userId);
  const vente = await prisma.venteComptoir.findUnique({
    where: { id: idVente },
    select: { id: true, idStructure: true, statut: true, idOperation: true },
  });
  if (!vente) throw new NotFoundError('Vente non trouvee');
  if (vente.idStructure !== idStructure) {
    throw new ForbiddenError("Cette vente n'est pas celle de votre officine");
  }

  if (vente.statut === StatutVente.EN_ATTENTE && vente.idOperation) {
    try {
      const operation = await chapchap.lireOperation(vente.idOperation);
      if (operation.statut) {
        await appliquerPaiementVente(idVente, operation.statut, {
          referenceTransaction: operation.referenceTransaction,
        });
      }
    } catch (e) {
      // Une passerelle injoignable ne doit pas empecher de lire la vente :
      // on rend ce qu'on sait, et l'ecran le dira.
      logger.warn('[VENTE] relecture du paiement impossible', {
        idVente, erreur: (e as Error).message,
      });
    }
  }

  const apres = await prisma.venteComptoir.findUniqueOrThrow({
    where: { id: idVente }, include: VENTE_INCLUDE,
  });
  return versVue(apres);
}

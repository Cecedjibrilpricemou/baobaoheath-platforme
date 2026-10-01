// src/services/approvisionnement.service.ts
//
// Entrees en stock par lots, et peremptions (addendum du 2026-09-28,
// points 1.3 et 1.4).
//
// Le stock reste un total ; les lots en donnent le detail. C'est ce detail qui
// rend possibles deux choses qu'une officine attend : sortir au plus proche de
// la peremption plutot qu'au hasard, et voir venir les dates.
import { Prisma } from '../config/generated/client/client';
import { prisma } from '../config/prisma';
import { JwtPayload } from '../types/auth.types';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/app-error';
import { prochainNumero } from './numero.service';
import type {
  ApprovisionnementView,
  CreerApprovisionnementDto,
  LotStockView,
  PeremptionProcheView,
} from '@baobaoheath/shared-types';

/**
 * Seuil d'alerte sur les peremptions, en jours. Administrable par variable
 * d'environnement en attendant l'ecran de parametres (P11).
 */
const PEREMPTION_ALERTE_JOURS = Number(process.env.STOCK_PEREMPTION_ALERTE_JOURS ?? 90);

async function structureDe(userId: string): Promise<string> {
  const u = await prisma.utilisateur.findUnique({ where: { id: userId }, select: { idStructure: true } });
  if (!u?.idStructure) throw new ForbiddenError('Aucune structure rattachee a votre compte');
  return u.idStructure;
}

const APPRO_INCLUDE = {
  saisiPar: { select: { id: true, prenom: true, nom: true } },
  lots: {
    include: { stock: { include: { medicament: { select: { id: true, libelle: true, categorie: true, dci: true, nomCommercial: true, dosage: true, forme: true } } } } },
    orderBy: { creeLe: 'asc' },
  },
} satisfies Prisma.ApprovisionnementInclude;

type ApproRow = Prisma.ApprovisionnementGetPayload<{ include: typeof APPRO_INCLUDE }>;

function versLotView(l: ApproRow['lots'][number]): LotStockView {
  return {
    id: l.id,
    numeroLot: l.numeroLot,
    quantite: l.quantite,
    quantiteRecue: l.quantiteRecue,
    datePeremption: l.datePeremption?.toISOString() ?? null,
    prixAchatGnf: l.prixAchatGnf,
    medicament: {
      id: l.stock.medicament.id,
      libelle: l.stock.medicament.libelle,
      categorie: l.stock.medicament.categorie,
      dci: l.stock.medicament.dci,
      nomCommercial: l.stock.medicament.nomCommercial,
      dosage: l.stock.medicament.dosage,
      forme: l.stock.medicament.forme,
    },
  };
}

function versApproView(a: ApproRow): ApprovisionnementView {
  return {
    id: a.id,
    numero: a.numero,
    numeroFacture: a.numeroFacture,
    fournisseur: a.fournisseur,
    dateFacture: a.dateFacture.toISOString(),
    justificatifUrl: a.justificatifUrl,
    montantTotalGnf: a.montantTotalGnf,
    creeLe: a.creeLe.toISOString(),
    saisiPar: a.saisiPar,
    lots: a.lots.map(versLotView),
  };
}

/**
 * Enregistre une facture d'approvisionnement : chaque ligne devient un lot,
 * et le total du stock suit.
 *
 * Saisie assistee, pas extraction automatique. La facture est attachee en
 * justificatif ; la lecture du document viendra ensuite, et devra toujours
 * etre relue avant enregistrement — une erreur sur une quantite ou une
 * peremption entrerait sinon en silence dans le stock d'un medicament.
 */
export async function enregistrerApprovisionnement(
  user: JwtPayload,
  dto: CreerApprovisionnementDto
): Promise<ApprovisionnementView> {
  const idStructure = await structureDe(user.userId);

  const dateFacture = new Date(dto.dateFacture);
  if (Number.isNaN(dateFacture.getTime())) throw new ValidationError('Date de facture invalide');
  if (dto.lignes.length === 0) throw new ValidationError('La facture ne contient aucune ligne');

  // Les medicaments doivent exister : une facture qui cite un produit inconnu
  // du catalogue est une facture qu'on ne sait pas ranger.
  const ids = [...new Set(dto.lignes.map((l) => l.idMedicament))];
  const connus = await prisma.medicament.findMany({ where: { id: { in: ids }, estActif: true }, select: { id: true } });
  if (connus.length !== ids.length) throw new ValidationError('Un ou plusieurs produits sont inconnus du catalogue');

  // Une peremption deja passee a l'entree : c'est une erreur de saisie, et la
  // laisser entrer ferait sortir un lot perime plus tard.
  const maintenant = new Date();
  for (const l of dto.lignes) {
    if (!l.datePeremption) continue;
    const d = new Date(l.datePeremption);
    if (Number.isNaN(d.getTime())) throw new ValidationError('Date de peremption invalide');
    if (d <= maintenant) throw new ValidationError('Un lot deja perime ne peut pas entrer en stock');
  }

  const cree = await prisma.$transaction(async (tx) => {
    const numero = await prochainNumero('AP', tx);

    const appro = await tx.approvisionnement.create({
      data: {
        numero,
        numeroFacture: dto.numeroFacture?.trim() || null,
        fournisseur: dto.fournisseur.trim(),
        dateFacture,
        justificatifUrl: dto.justificatifUrl?.trim() || null,
        montantTotalGnf: dto.lignes.reduce((t, l) => t + (l.prixAchatGnf ?? 0) * l.quantite, 0),
        idStructure,
        idSaisiPar: user.userId,
      },
    });

    for (const ligne of dto.lignes) {
      // Le stock du produit dans cette officine, cree au besoin : une premiere
      // livraison ne doit pas echouer faute de ligne de stock.
      const stock = await tx.stock.upsert({
        where: { idStructure_idMedicament: { idStructure, idMedicament: ligne.idMedicament } },
        update: { quantite: { increment: ligne.quantite } },
        create: {
          idStructure,
          idMedicament: ligne.idMedicament,
          quantite: ligne.quantite,
          unite: ligne.unite ?? 'boite',
        },
      });

      await tx.lotStock.create({
        data: {
          idStock: stock.id,
          idApprovisionnement: appro.id,
          numeroLot: ligne.numeroLot?.trim() || null,
          quantite: ligne.quantite,
          quantiteRecue: ligne.quantite,
          datePeremption: ligne.datePeremption ? new Date(ligne.datePeremption) : null,
          prixAchatGnf: ligne.prixAchatGnf ?? 0,
        },
      });
    }

    return appro.id;
  });

  const vue = await prisma.approvisionnement.findUniqueOrThrow({ where: { id: cree }, include: APPRO_INCLUDE });
  return versApproView(vue);
}

export async function listerApprovisionnements(user: JwtPayload): Promise<ApprovisionnementView[]> {
  const idStructure = await structureDe(user.userId);
  const rows = await prisma.approvisionnement.findMany({
    where: { idStructure },
    include: APPRO_INCLUDE,
    orderBy: { dateFacture: 'desc' },
    take: 50,
  });
  return rows.map(versApproView);
}

/**
 * Les lots qui approchent de leur date, ou l'ont depassee.
 *
 * Les perimes d'abord : ce sont ceux qu'il faut retirer des rayons, pas
 * seulement surveiller.
 */
export async function peremptionsProches(user: JwtPayload, jours?: number): Promise<PeremptionProcheView[]> {
  const idStructure = await structureDe(user.userId);
  const seuil = jours ?? PEREMPTION_ALERTE_JOURS;
  const limite = new Date(Date.now() + seuil * 86_400_000);

  const lots = await prisma.lotStock.findMany({
    where: {
      quantite: { gt: 0 },
      datePeremption: { not: null, lte: limite },
      stock: { idStructure },
    },
    include: {
      stock: { include: { medicament: { select: { id: true, libelle: true, categorie: true, dci: true, nomCommercial: true, dosage: true, forme: true } } } },
    },
    orderBy: { datePeremption: 'asc' },
    take: 200,
  });

  const maintenant = Date.now();
  return lots.map((l) => {
    const peremption = l.datePeremption!;
    const joursRestants = Math.floor((peremption.getTime() - maintenant) / 86_400_000);
    return {
      idLot: l.id,
      numeroLot: l.numeroLot,
      quantite: l.quantite,
      datePeremption: peremption.toISOString(),
      joursRestants,
      perime: joursRestants < 0,
      medicament: {
        id: l.stock.medicament.id,
        libelle: l.stock.medicament.libelle,
        categorie: l.stock.medicament.categorie,
        dci: l.stock.medicament.dci,
        nomCommercial: l.stock.medicament.nomCommercial,
        dosage: l.stock.medicament.dosage,
        forme: l.stock.medicament.forme,
      },
      unite: l.stock.unite,
    };
  });
}

/** Les lots d'un produit dans cette officine, du plus proche au plus lointain. */
export async function lotsDuMedicament(user: JwtPayload, idMedicament: string): Promise<LotStockView[]> {
  const idStructure = await structureDe(user.userId);
  const stock = await prisma.stock.findFirst({
    where: { idStructure, idMedicament },
    include: {
      medicament: { select: { id: true, libelle: true, categorie: true, dci: true, nomCommercial: true, dosage: true, forme: true } },
      lots: { orderBy: [{ datePeremption: { sort: 'asc', nulls: 'last' } }, { creeLe: 'asc' }] },
    },
  });
  if (!stock) throw new NotFoundError('Ce produit n est pas en stock dans votre officine');

  return stock.lots.map((l) => ({
    id: l.id,
    numeroLot: l.numeroLot,
    quantite: l.quantite,
    quantiteRecue: l.quantiteRecue,
    datePeremption: l.datePeremption?.toISOString() ?? null,
    prixAchatGnf: l.prixAchatGnf,
    medicament: {
      id: stock.medicament.id,
      libelle: stock.medicament.libelle,
      categorie: stock.medicament.categorie,
      dci: stock.medicament.dci,
      nomCommercial: stock.medicament.nomCommercial,
      dosage: stock.medicament.dosage,
      forme: stock.medicament.forme,
    },
  }));
}

/**
 * Sort `quantite` unites d'un stock, au plus proche de la peremption.
 *
 * C'est la regle attendue dans une pharmacie : on ecoule d'abord ce qui
 * perime le plus tot, sinon les lots anciens restent au fond et se perdent.
 *
 * **Un lot perime ne sort jamais**, meme s'il reste du stock : le total peut
 * donc etre suffisant alors que la sortie echoue, et c'est voulu — dire
 * « stock insuffisant » serait faux, on dit ce qui se passe.
 *
 * A appeler dans la transaction qui decremente le total, jamais seule : les
 * deux doivent tomber ensemble.
 */
export async function consommerLots(
  // Le client de transaction tel que ce projet le produit : le client Prisma
  // est etendu (chiffrement), donc `Prisma.TransactionClient` ne correspond
  // pas. On le derive de la signature reelle plutot que de l'affirmer.
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  idStock: string,
  quantite: number,
  maintenant = new Date()
): Promise<{ idLot: string; quantite: number }[]> {
  const lots = await tx.lotStock.findMany({
    where: {
      idStock,
      quantite: { gt: 0 },
      // Ni perime, ni bientot : la date du jour suffit.
      OR: [{ datePeremption: null }, { datePeremption: { gt: maintenant } }],
    },
    orderBy: [{ datePeremption: { sort: 'asc', nulls: 'last' } }, { creeLe: 'asc' }],
  });

  const disponible = lots.reduce((t, l) => t + l.quantite, 0);
  if (disponible < quantite) {
    throw new ConflictError(
      `Quantite insuffisante en lots non perimes : ${disponible} disponible(s) sur ${quantite} demandee(s)`
    );
  }

  const sorties: { idLot: string; quantite: number }[] = [];
  let reste = quantite;
  for (const lot of lots) {
    if (reste === 0) break;
    const pris = Math.min(lot.quantite, reste);
    await tx.lotStock.update({ where: { id: lot.id }, data: { quantite: { decrement: pris } } });
    sorties.push({ idLot: lot.id, quantite: pris });
    reste -= pris;
  }
  return sorties;
}

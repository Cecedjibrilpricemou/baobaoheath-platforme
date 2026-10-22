import { MouvementType } from '../config/generated/client/client';
import { prisma } from '../config/prisma';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/app-error';
import type { AjustementLotStockView, MouvementStockView } from '@baobaoheath/shared-types';
import type { JwtPayload } from '../types/auth.types';

type TransactionClient = Parameters<
  Parameters<typeof prisma.$transaction>[0]
>[0];

type MouvementStockInput = {
  type: MouvementType;
  quantite: number;
  reference?: string;
  motif?: string;
  idStructure: string;
  idMedicament: string;
  idStock: string;
  idLot: string;
  idUtilisateur: string;
};

export async function enregistrerMouvementStock(
  tx: TransactionClient,
  mouvement: MouvementStockInput,
): Promise<void> {
  if (!Number.isInteger(mouvement.quantite) || mouvement.quantite === 0) {
    throw new Error(
      'La quantite du mouvement de stock doit etre un entier non nul',
    );
  }

  await tx.mouvementStock.create({ data: mouvement });
}

export async function listerMouvementsStock(
  userId: string,
  limite = 100
): Promise<MouvementStockView[]> {
  const utilisateur = await prisma.utilisateur.findUnique({
    where: { id: userId },
    select: { idStructure: true },
  });
  if (!utilisateur?.idStructure) throw new ForbiddenError('Aucune structure rattachee a votre compte');

  const rows = await prisma.mouvementStock.findMany({
    where: { idStructure: utilisateur.idStructure },
    include: {
      medicament: { select: { id: true, libelle: true } },
      lot: { select: { id: true, numeroLot: true } },
      utilisateur: { select: { id: true, prenom: true, nom: true } },
    },
    orderBy: [{ creeLe: 'desc' }, { id: 'desc' }],
    take: Math.min(Math.max(Math.trunc(limite), 1), 200),
  });

  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    quantite: row.quantite,
    reference: row.reference,
    motif: row.motif,
    creeLe: row.creeLe.toISOString(),
    medicament: row.medicament,
    lot: row.lot,
    utilisateur: row.utilisateur,
  }));
}

export async function ajusterLotStock(
  user: JwtPayload,
  idLot: string,
  quantiteComptee: number,
  motif: string
): Promise<AjustementLotStockView> {
  if (!Number.isInteger(quantiteComptee) || quantiteComptee < 0) {
    throw new ValidationError('La quantite comptee doit etre un entier positif ou nul');
  }
  const justification = motif.trim();
  if (justification.length < 5 || justification.length > 300) {
    throw new ValidationError('Le motif doit contenir entre 5 et 300 caracteres');
  }

  const utilisateur = await prisma.utilisateur.findUnique({
    where: { id: user.userId },
    select: { idStructure: true },
  });
  if (!utilisateur?.idStructure) throw new ForbiddenError('Aucune structure rattachee a votre compte');

  const lot = await prisma.lotStock.findFirst({
    where: { id: idLot, stock: { idStructure: utilisateur.idStructure } },
    select: {
      id: true,
      quantite: true,
      idStock: true,
      stock: { select: { idStructure: true, idMedicament: true } },
    },
  });
  if (!lot) throw new NotFoundError('Lot introuvable dans votre officine');

  const variation = quantiteComptee - lot.quantite;
  if (variation === 0) {
    return {
      idLot: lot.id,
      quantiteAvant: lot.quantite,
      quantiteComptee,
      variation,
      idMouvement: null,
    };
  }

  return prisma.$transaction(async (tx) => {
    const lotMisAJour = await tx.lotStock.updateMany({
      where: { id: lot.id, quantite: lot.quantite },
      data: { quantite: quantiteComptee },
    });
    if (lotMisAJour.count !== 1) {
      throw new ConflictError('Le lot a ete modifie pendant l inventaire. Rechargez puis recommencez.');
    }

    const stockMisAJour = await tx.stock.updateMany({
      where: {
        id: lot.idStock,
        ...(variation < 0 ? { quantite: { gte: -variation } } : {}),
      },
      data: { quantite: { increment: variation } },
    });
    if (stockMisAJour.count !== 1) {
      throw new ConflictError('Le stock total ne permet pas cet ajustement. Verifiez les lots.');
    }

    const mouvement = await tx.mouvementStock.create({
      data: {
        type: 'AJUSTEMENT',
        quantite: variation,
        reference: lot.id,
        motif: justification,
        idStructure: lot.stock.idStructure!,
        idMedicament: lot.stock.idMedicament,
        idStock: lot.idStock,
        idLot: lot.id,
        idUtilisateur: user.userId,
      },
      select: { id: true },
    });

    return {
      idLot: lot.id,
      quantiteAvant: lot.quantite,
      quantiteComptee,
      variation,
      idMouvement: mouvement.id,
    };
  });
}

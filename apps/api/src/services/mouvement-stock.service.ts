import { MouvementType } from '../config/generated/client/client';
import { prisma } from '../config/prisma';

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

-- CreateEnum
CREATE TYPE "MouvementType" AS ENUM ('ENTREE', 'SORTIE', 'AJUSTEMENT', 'CORRECTION');

-- DropIndex
DROP INDEX "ventes_comptoir_idSessionCaisse_idx";

-- CreateTable
CREATE TABLE "mouvements_stock" (
    "id" TEXT NOT NULL,
    "type" "MouvementType" NOT NULL,
    "quantite" INTEGER NOT NULL,
    "reference" TEXT,
    "motif" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idStructure" TEXT NOT NULL,
    "idMedicament" TEXT,
    "idStock" TEXT,
    "idLot" TEXT,
    "idUtilisateur" TEXT NOT NULL,

    CONSTRAINT "mouvements_stock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mouvements_stock_idStructure_creeLe_idx" ON "mouvements_stock"("idStructure", "creeLe" DESC);

-- CreateIndex
CREATE INDEX "mouvements_stock_idMedicament_idx" ON "mouvements_stock"("idMedicament");

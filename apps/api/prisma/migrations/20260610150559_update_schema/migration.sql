/*
  Warnings:

  - The `modePaiement` column on the `factures` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "ModePaiement" AS ENUM ('ESPECES', 'ORANGE_MONEY', 'MTN_MOMO');

-- AlterTable
ALTER TABLE "factures" DROP COLUMN "modePaiement",
ADD COLUMN     "modePaiement" "ModePaiement";

-- AlterTable
ALTER TABLE "medicaments" ADD COLUMN     "prixUnitaireGnf" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ordonnances" ADD COLUMN     "quantite" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "patients" ADD COLUMN     "idAscPrincipal" TEXT,
ADD COLUMN     "idStructurePreferee" TEXT;

-- AlterTable
ALTER TABLE "stocks" ADD COLUMN     "margeGnf" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ussd_sessions" ALTER COLUMN "modifieLe" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_idStructurePreferee_fkey" FOREIGN KEY ("idStructurePreferee") REFERENCES "structures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_idAscPrincipal_fkey" FOREIGN KEY ("idAscPrincipal") REFERENCES "profils_asc"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "alertes_epidemiologiques_pathologie_prefecture_fenetreJours_sta" RENAME TO "alertes_epidemiologiques_pathologie_prefecture_fenetreJours_key";

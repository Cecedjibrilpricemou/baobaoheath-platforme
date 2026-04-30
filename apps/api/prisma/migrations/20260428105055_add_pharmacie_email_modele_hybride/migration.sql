/*
  Warnings:

  - The `modePaiement` column on the `factures` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "ModePaiement" AS ENUM ('ESPECES', 'ORANGE_MONEY', 'MTN_MOMO');

-- AlterEnum
ALTER TYPE "TypeStructure" ADD VALUE 'PHARMACIE';

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

-- CreateTable
CREATE TABLE "profils_pharmacien" (
    "id" TEXT NOT NULL,
    "photoUrl" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idUtilisateur" TEXT NOT NULL,
    "idStructure" TEXT,

    CONSTRAINT "profils_pharmacien_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "profils_pharmacien_idUtilisateur_key" ON "profils_pharmacien"("idUtilisateur");

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_idStructurePreferee_fkey" FOREIGN KEY ("idStructurePreferee") REFERENCES "structures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_idAscPrincipal_fkey" FOREIGN KEY ("idAscPrincipal") REFERENCES "profils_asc"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profils_pharmacien" ADD CONSTRAINT "profils_pharmacien_idUtilisateur_fkey" FOREIGN KEY ("idUtilisateur") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profils_pharmacien" ADD CONSTRAINT "profils_pharmacien_idStructure_fkey" FOREIGN KEY ("idStructure") REFERENCES "structures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

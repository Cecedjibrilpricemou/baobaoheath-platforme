-- CreateEnum
CREATE TYPE "LieuPrelevement" AS ENUM ('SUR_PLACE', 'DOMICILE');

-- CreateEnum
CREATE TYPE "InterpretationResultat" AS ENUM ('NORMAL', 'ANORMAL', 'CRITIQUE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Role" ADD VALUE 'TECHNICIEN_LABO';
ALTER TYPE "Role" ADD VALUE 'BIOLOGISTE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TypeNotification" ADD VALUE 'PRELEVEMENT_PLANIFIE';
ALTER TYPE "TypeNotification" ADD VALUE 'RESULTATS_DISPONIBLES';
ALTER TYPE "TypeNotification" ADD VALUE 'RESULTAT_CRITIQUE';
ALTER TYPE "TypeNotification" ADD VALUE 'ESCALADE_CRITIQUE';

-- AlterTable
ALTER TABLE "demandes_analyse" ADD COLUMN     "commentaireBiologiste" TEXT,
ADD COLUMN     "creneauPrelevement" TIMESTAMP(3),
ADD COLUMN     "diffuseePatientLe" TIMESTAMP(3),
ADD COLUMN     "idValideur" TEXT,
ADD COLUMN     "lieuPrelevement" "LieuPrelevement",
ADD COLUMN     "preleveeLe" TIMESTAMP(3),
ADD COLUMN     "recueLe" TIMESTAMP(3),
ADD COLUMN     "valideeLe" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "examens" ADD COLUMN     "critiqueMax" DOUBLE PRECISION,
ADD COLUMN     "critiqueMin" DOUBLE PRECISION,
ADD COLUMN     "refMax" DOUBLE PRECISION,
ADD COLUMN     "refMin" DOUBLE PRECISION,
ADD COLUMN     "refTexte" TEXT;

-- CreateTable
CREATE TABLE "echantillons" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "specimen" TEXT NOT NULL,
    "preleveLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "commentaire" TEXT,
    "idDemande" TEXT NOT NULL,
    "idPreleveur" TEXT NOT NULL,

    CONSTRAINT "echantillons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resultats_analyse" (
    "id" TEXT NOT NULL,
    "valeur" TEXT NOT NULL,
    "valeurNumerique" DOUBLE PRECISION,
    "unite" TEXT,
    "refMin" DOUBLE PRECISION,
    "refMax" DOUBLE PRECISION,
    "refTexte" TEXT,
    "interpretation" "InterpretationResultat" NOT NULL DEFAULT 'NORMAL',
    "commentaire" TEXT,
    "saisiLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifieLe" TIMESTAMP(3) NOT NULL,
    "idLigne" TEXT NOT NULL,
    "idEchantillon" TEXT,
    "idSaisiPar" TEXT NOT NULL,

    CONSTRAINT "resultats_analyse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alertes_resultat_critique" (
    "id" TEXT NOT NULL,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accuseeLe" TIMESTAMP(3),
    "escaladeeLe" TIMESTAMP(3),
    "idDemande" TEXT NOT NULL,
    "idResultat" TEXT NOT NULL,
    "idDestinataire" TEXT NOT NULL,
    "idEscaladeVers" TEXT,

    CONSTRAINT "alertes_resultat_critique_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "echantillons_code_key" ON "echantillons"("code");

-- CreateIndex
CREATE INDEX "echantillons_idDemande_idx" ON "echantillons"("idDemande");

-- CreateIndex
CREATE UNIQUE INDEX "resultats_analyse_idLigne_key" ON "resultats_analyse"("idLigne");

-- CreateIndex
CREATE INDEX "alertes_resultat_critique_idDestinataire_accuseeLe_idx" ON "alertes_resultat_critique"("idDestinataire", "accuseeLe");

-- CreateIndex
CREATE INDEX "alertes_resultat_critique_accuseeLe_escaladeeLe_creeLe_idx" ON "alertes_resultat_critique"("accuseeLe", "escaladeeLe", "creeLe");

-- AddForeignKey
ALTER TABLE "demandes_analyse" ADD CONSTRAINT "demandes_analyse_idValideur_fkey" FOREIGN KEY ("idValideur") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "echantillons" ADD CONSTRAINT "echantillons_idDemande_fkey" FOREIGN KEY ("idDemande") REFERENCES "demandes_analyse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "echantillons" ADD CONSTRAINT "echantillons_idPreleveur_fkey" FOREIGN KEY ("idPreleveur") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resultats_analyse" ADD CONSTRAINT "resultats_analyse_idLigne_fkey" FOREIGN KEY ("idLigne") REFERENCES "lignes_demande_analyse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resultats_analyse" ADD CONSTRAINT "resultats_analyse_idEchantillon_fkey" FOREIGN KEY ("idEchantillon") REFERENCES "echantillons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resultats_analyse" ADD CONSTRAINT "resultats_analyse_idSaisiPar_fkey" FOREIGN KEY ("idSaisiPar") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alertes_resultat_critique" ADD CONSTRAINT "alertes_resultat_critique_idDemande_fkey" FOREIGN KEY ("idDemande") REFERENCES "demandes_analyse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alertes_resultat_critique" ADD CONSTRAINT "alertes_resultat_critique_idResultat_fkey" FOREIGN KEY ("idResultat") REFERENCES "resultats_analyse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alertes_resultat_critique" ADD CONSTRAINT "alertes_resultat_critique_idDestinataire_fkey" FOREIGN KEY ("idDestinataire") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alertes_resultat_critique" ADD CONSTRAINT "alertes_resultat_critique_idEscaladeVers_fkey" FOREIGN KEY ("idEscaladeVers") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

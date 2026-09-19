-- CreateEnum
CREATE TYPE "StatutEpisode" AS ENUM ('OUVERT', 'EN_COURS', 'CLOS', 'ANNULE');

-- CreateEnum
CREATE TYPE "StatutDemandeAnalyse" AS ENUM ('TRANSMISE', 'RECUE', 'PRELEVEE', 'EN_ANALYSE', 'VALIDEE', 'ANNULEE');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'AGENT_ACCUEIL';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TypeNotification" ADD VALUE 'EPISODE_OUVERT';
ALTER TYPE "TypeNotification" ADD VALUE 'DEMANDE_ANALYSE';
ALTER TYPE "TypeNotification" ADD VALUE 'ORIENTATION';

-- AlterEnum
ALTER TYPE "TypeStructure" ADD VALUE 'LABORATOIRE';

-- DropForeignKey
ALTER TABLE "rendez_vous" DROP CONSTRAINT "rendez_vous_idAsc_fkey";

-- AlterTable
ALTER TABLE "consultations" ADD COLUMN     "idEpisode" TEXT;

-- AlterTable
ALTER TABLE "rendez_vous" ADD COLUMN     "idEpisode" TEXT,
ADD COLUMN     "idMedecin" TEXT,
ALTER COLUMN "idAsc" DROP NOT NULL;

-- CreateTable
CREATE TABLE "compteurs" (
    "cle" TEXT NOT NULL,
    "valeur" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "compteurs_pkey" PRIMARY KEY ("cle")
);

-- CreateTable
CREATE TABLE "episodes_soins" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "motif" TEXT NOT NULL,
    "service" TEXT,
    "statut" "StatutEpisode" NOT NULL DEFAULT 'OUVERT',
    "notes" TEXT,
    "ouvertLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closLe" TIMESTAMP(3),
    "modifieLe" TIMESTAMP(3) NOT NULL,
    "idPatient" TEXT NOT NULL,
    "idStructure" TEXT NOT NULL,
    "idOuvertPar" TEXT NOT NULL,
    "idResponsable" TEXT,

    CONSTRAINT "episodes_soins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "examens" (
    "id" TEXT NOT NULL,
    "codeLoinc" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "categorie" TEXT NOT NULL,
    "specimen" TEXT NOT NULL,
    "unite" TEXT,
    "aJeun" BOOLEAN NOT NULL DEFAULT false,
    "consignes" TEXT,
    "prixGnf" INTEGER,
    "actif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "examens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demandes_analyse" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "urgence" "Urgence" NOT NULL DEFAULT 'ROUTINE',
    "statut" "StatutDemandeAnalyse" NOT NULL DEFAULT 'TRANSMISE',
    "indicationClinique" TEXT,
    "consignesPatient" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transmiseLe" TIMESTAMP(3),
    "modifieLe" TIMESTAMP(3) NOT NULL,
    "annuleeLe" TIMESTAMP(3),
    "motifAnnulation" TEXT,
    "idEpisode" TEXT NOT NULL,
    "idPatient" TEXT NOT NULL,
    "idPrescripteur" TEXT NOT NULL,
    "idLaboratoire" TEXT NOT NULL,

    CONSTRAINT "demandes_analyse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lignes_demande_analyse" (
    "id" TEXT NOT NULL,
    "commentaire" TEXT,
    "idDemande" TEXT NOT NULL,
    "idExamen" TEXT NOT NULL,

    CONSTRAINT "lignes_demande_analyse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "episodes_soins_numero_key" ON "episodes_soins"("numero");

-- CreateIndex
CREATE INDEX "episodes_soins_idStructure_statut_ouvertLe_idx" ON "episodes_soins"("idStructure", "statut", "ouvertLe" DESC);

-- CreateIndex
CREATE INDEX "episodes_soins_idPatient_ouvertLe_idx" ON "episodes_soins"("idPatient", "ouvertLe" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "examens_codeLoinc_key" ON "examens"("codeLoinc");

-- CreateIndex
CREATE INDEX "examens_categorie_actif_idx" ON "examens"("categorie", "actif");

-- CreateIndex
CREATE UNIQUE INDEX "demandes_analyse_numero_key" ON "demandes_analyse"("numero");

-- CreateIndex
CREATE INDEX "demandes_analyse_idLaboratoire_statut_urgence_creeLe_idx" ON "demandes_analyse"("idLaboratoire", "statut", "urgence", "creeLe");

-- CreateIndex
CREATE INDEX "demandes_analyse_idPatient_creeLe_idx" ON "demandes_analyse"("idPatient", "creeLe" DESC);

-- CreateIndex
CREATE INDEX "demandes_analyse_idEpisode_idx" ON "demandes_analyse"("idEpisode");

-- CreateIndex
CREATE UNIQUE INDEX "lignes_demande_analyse_idDemande_idExamen_key" ON "lignes_demande_analyse"("idDemande", "idExamen");

-- CreateIndex
CREATE INDEX "consultations_idEpisode_idx" ON "consultations"("idEpisode");

-- CreateIndex
CREATE INDEX "rendez_vous_idMedecin_prevuLe_idx" ON "rendez_vous"("idMedecin", "prevuLe");

-- CreateIndex
CREATE INDEX "rendez_vous_idEpisode_idx" ON "rendez_vous"("idEpisode");

-- AddForeignKey
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_idEpisode_fkey" FOREIGN KEY ("idEpisode") REFERENCES "episodes_soins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rendez_vous" ADD CONSTRAINT "rendez_vous_idAsc_fkey" FOREIGN KEY ("idAsc") REFERENCES "profils_asc"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rendez_vous" ADD CONSTRAINT "rendez_vous_idMedecin_fkey" FOREIGN KEY ("idMedecin") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rendez_vous" ADD CONSTRAINT "rendez_vous_idEpisode_fkey" FOREIGN KEY ("idEpisode") REFERENCES "episodes_soins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "episodes_soins" ADD CONSTRAINT "episodes_soins_idPatient_fkey" FOREIGN KEY ("idPatient") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "episodes_soins" ADD CONSTRAINT "episodes_soins_idStructure_fkey" FOREIGN KEY ("idStructure") REFERENCES "structures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "episodes_soins" ADD CONSTRAINT "episodes_soins_idOuvertPar_fkey" FOREIGN KEY ("idOuvertPar") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "episodes_soins" ADD CONSTRAINT "episodes_soins_idResponsable_fkey" FOREIGN KEY ("idResponsable") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demandes_analyse" ADD CONSTRAINT "demandes_analyse_idEpisode_fkey" FOREIGN KEY ("idEpisode") REFERENCES "episodes_soins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demandes_analyse" ADD CONSTRAINT "demandes_analyse_idPatient_fkey" FOREIGN KEY ("idPatient") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demandes_analyse" ADD CONSTRAINT "demandes_analyse_idPrescripteur_fkey" FOREIGN KEY ("idPrescripteur") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demandes_analyse" ADD CONSTRAINT "demandes_analyse_idLaboratoire_fkey" FOREIGN KEY ("idLaboratoire") REFERENCES "structures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lignes_demande_analyse" ADD CONSTRAINT "lignes_demande_analyse_idDemande_fkey" FOREIGN KEY ("idDemande") REFERENCES "demandes_analyse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lignes_demande_analyse" ADD CONSTRAINT "lignes_demande_analyse_idExamen_fkey" FOREIGN KEY ("idExamen") REFERENCES "examens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

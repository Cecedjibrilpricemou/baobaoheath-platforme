-- CreateEnum
CREATE TYPE "StatutDemandeRendezVous" AS ENUM ('EN_ATTENTE', 'ACCEPTEE', 'REFUSEE', 'ANNULEE');

-- CreateTable
CREATE TABLE "demandes_rendez_vous" (
    "id" TEXT NOT NULL,
    "motif" TEXT NOT NULL,
    "statut" "StatutDemandeRendezVous" NOT NULL DEFAULT 'EN_ATTENTE',
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifieLe" TIMESTAMP(3) NOT NULL,
    "traiteeLe" TIMESTAMP(3),
    "motifRefus" TEXT,
    "idPatient" TEXT NOT NULL,
    "idStructure" TEXT NOT NULL,
    "idMedecin" TEXT,
    "idTraitePar" TEXT,
    "idEpisode" TEXT,

    CONSTRAINT "demandes_rendez_vous_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "demandes_rendez_vous_idEpisode_key" ON "demandes_rendez_vous"("idEpisode");

-- CreateIndex
CREATE INDEX "demandes_rendez_vous_idPatient_creeLe_idx" ON "demandes_rendez_vous"("idPatient", "creeLe" DESC);

-- CreateIndex
CREATE INDEX "demandes_rendez_vous_idMedecin_statut_idx" ON "demandes_rendez_vous"("idMedecin", "statut");

-- CreateIndex
CREATE INDEX "demandes_rendez_vous_idStructure_statut_idx" ON "demandes_rendez_vous"("idStructure", "statut");

-- AddForeignKey
ALTER TABLE "demandes_rendez_vous" ADD CONSTRAINT "demandes_rendez_vous_idPatient_fkey" FOREIGN KEY ("idPatient") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demandes_rendez_vous" ADD CONSTRAINT "demandes_rendez_vous_idStructure_fkey" FOREIGN KEY ("idStructure") REFERENCES "structures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demandes_rendez_vous" ADD CONSTRAINT "demandes_rendez_vous_idMedecin_fkey" FOREIGN KEY ("idMedecin") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demandes_rendez_vous" ADD CONSTRAINT "demandes_rendez_vous_idTraitePar_fkey" FOREIGN KEY ("idTraitePar") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demandes_rendez_vous" ADD CONSTRAINT "demandes_rendez_vous_idEpisode_fkey" FOREIGN KEY ("idEpisode") REFERENCES "episodes_soins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

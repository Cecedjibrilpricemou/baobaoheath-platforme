-- AlterTable
ALTER TABLE "demandes_analyse" ADD COLUMN     "commentaireMedecin" TEXT,
ADD COLUMN     "escaladeLiberationLe" TIMESTAMP(3),
ADD COLUMN     "idLiberePar" TEXT,
ADD COLUMN     "relanceLiberationLe" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "demandes_analyse_idPrescripteur_statut_diffuseePatientLe_idx" ON "demandes_analyse"("idPrescripteur", "statut", "diffuseePatientLe");

-- CreateIndex
CREATE INDEX "demandes_analyse_statut_diffuseePatientLe_valideeLe_idx" ON "demandes_analyse"("statut", "diffuseePatientLe", "valideeLe");

-- AddForeignKey
ALTER TABLE "demandes_analyse" ADD CONSTRAINT "demandes_analyse_idLiberePar_fkey" FOREIGN KEY ("idLiberePar") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

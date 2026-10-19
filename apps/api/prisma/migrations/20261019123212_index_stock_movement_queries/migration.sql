-- DropIndex
DROP INDEX "mouvements_stock_idMedicament_idx";

-- CreateIndex
CREATE INDEX "mouvements_stock_idStructure_idMedicament_creeLe_idx" ON "mouvements_stock"("idStructure", "idMedicament", "creeLe" DESC);

-- CreateIndex
CREATE INDEX "mouvements_stock_idStructure_idUtilisateur_creeLe_idx" ON "mouvements_stock"("idStructure", "idUtilisateur", "creeLe" DESC);

-- CreateIndex
CREATE INDEX "mouvements_stock_idLot_creeLe_idx" ON "mouvements_stock"("idLot", "creeLe" DESC);

-- CreateIndex
CREATE INDEX "mouvements_stock_reference_idx" ON "mouvements_stock"("reference");

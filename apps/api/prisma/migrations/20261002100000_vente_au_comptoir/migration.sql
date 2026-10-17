-- CreateEnum
CREATE TYPE "StatutVente" AS ENUM ('PAYEE', 'ANNULEE');
-- CreateTable
CREATE TABLE "ventes_comptoir" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "statut" "StatutVente" NOT NULL DEFAULT 'PAYEE',
    "montantBrutGnf" INTEGER NOT NULL,
    "remiseGnf" INTEGER NOT NULL DEFAULT 0,
    "montantNetGnf" INTEGER NOT NULL,
    "modePaiement" "ModePaiement" NOT NULL,
    "numeroOperateur" TEXT,
    "idPatient" TEXT,
    "idOrdonnance" TEXT,
    "idStructure" TEXT NOT NULL,
    "idVendeur" TEXT NOT NULL,
    "annuleeLe" TIMESTAMP(3),
    "motifAnnulation" TEXT,
    "idAnnuleePar" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ventes_comptoir_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "lignes_vente" (
    "id" TEXT NOT NULL,
    "quantite" INTEGER NOT NULL,
    "prixUnitaireGnf" INTEGER NOT NULL,
    "montantGnf" INTEGER NOT NULL,
    "lotsConsommes" JSONB NOT NULL,
    "idVente" TEXT NOT NULL,
    "idMedicament" TEXT NOT NULL,
    CONSTRAINT "lignes_vente_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE UNIQUE INDEX "ventes_comptoir_numero_key" ON "ventes_comptoir"("numero");
-- CreateIndex
CREATE INDEX "ventes_comptoir_idStructure_creeLe_idx" ON "ventes_comptoir"("idStructure", "creeLe" DESC);
-- CreateIndex
CREATE INDEX "ventes_comptoir_idStructure_statut_idx" ON "ventes_comptoir"("idStructure", "statut");
-- CreateIndex
CREATE INDEX "lignes_vente_idVente_idx" ON "lignes_vente"("idVente");
-- CreateIndex
CREATE INDEX "lignes_vente_idMedicament_idx" ON "lignes_vente"("idMedicament");
-- AddForeignKey
ALTER TABLE "ventes_comptoir" ADD CONSTRAINT "ventes_comptoir_idPatient_fkey" FOREIGN KEY ("idPatient") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "ventes_comptoir" ADD CONSTRAINT "ventes_comptoir_idOrdonnance_fkey" FOREIGN KEY ("idOrdonnance") REFERENCES "ordonnances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "ventes_comptoir" ADD CONSTRAINT "ventes_comptoir_idStructure_fkey" FOREIGN KEY ("idStructure") REFERENCES "structures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "ventes_comptoir" ADD CONSTRAINT "ventes_comptoir_idVendeur_fkey" FOREIGN KEY ("idVendeur") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "ventes_comptoir" ADD CONSTRAINT "ventes_comptoir_idAnnuleePar_fkey" FOREIGN KEY ("idAnnuleePar") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "lignes_vente" ADD CONSTRAINT "lignes_vente_idVente_fkey" FOREIGN KEY ("idVente") REFERENCES "ventes_comptoir"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "lignes_vente" ADD CONSTRAINT "lignes_vente_idMedicament_fkey" FOREIGN KEY ("idMedicament") REFERENCES "medicaments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ------------------------------------------------------------------
-- Les invariants d'argent passent en contraintes, pas en convention.
--
-- La lecon des lots de stock (2026-09-30) : « la quantite est la somme des
-- lots » n'etait ecrit nulle part, et deux semences l'ont oublie sans que rien
-- ne le signale. Un chiffre d'affaires faux se remarque encore moins qu'un
-- stock indelivrable.
-- ------------------------------------------------------------------

ALTER TABLE "ventes_comptoir"
  ADD CONSTRAINT "ventes_comptoir_montants_coherents" CHECK (
    "montantBrutGnf" >= 0
    AND "remiseGnf" >= 0
    AND "remiseGnf" <= "montantBrutGnf"
    AND "montantNetGnf" = "montantBrutGnf" - "remiseGnf"
  );

-- Une annulation sans motif ni date n'est pas tracable : on ne saurait plus si
-- la vente a ete annulee ou si la ligne est corrompue.
ALTER TABLE "ventes_comptoir"
  ADD CONSTRAINT "ventes_comptoir_annulation_motivee" CHECK (
    "statut" <> 'ANNULEE'
    OR ("annuleeLe" IS NOT NULL AND "motifAnnulation" IS NOT NULL)
  );

ALTER TABLE "lignes_vente"
  ADD CONSTRAINT "lignes_vente_montant_coherent" CHECK (
    "quantite" > 0
    AND "prixUnitaireGnf" >= 0
    AND "montantGnf" = "quantite" * "prixUnitaireGnf"
  );

-- Ce qu'un assureur a verse a une pharmacie (addendum du 2026-09-28, point 5.2).
--
-- Sans cette table, « ce qui est paye » et « ce qui reste du » ne sont pas
-- calculables : on sait ce que l'assureur doit, rien ne dit ce qu'il a regle.

-- CreateTable
CREATE TABLE "reglements_assureur" (
    "id" TEXT NOT NULL,
    "idAssureur" TEXT NOT NULL,
    "idStructure" TEXT NOT NULL,
    "montantGnf" INTEGER NOT NULL,
    "periodeDebut" DATE NOT NULL,
    "periodeFin" DATE NOT NULL,
    "reference" TEXT,
    "idSaisiPar" TEXT NOT NULL,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reglements_assureur_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reglements_assureur_idAssureur_idStructure_idx" ON "reglements_assureur"("idAssureur", "idStructure");

-- CreateIndex
CREATE INDEX "reglements_assureur_idAssureur_periodeFin_idx" ON "reglements_assureur"("idAssureur", "periodeFin");

-- AddForeignKey
ALTER TABLE "reglements_assureur" ADD CONSTRAINT "reglements_assureur_idAssureur_fkey" FOREIGN KEY ("idAssureur") REFERENCES "assureurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reglements_assureur" ADD CONSTRAINT "reglements_assureur_idStructure_fkey" FOREIGN KEY ("idStructure") REFERENCES "structures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reglements_assureur" ADD CONSTRAINT "reglements_assureur_idSaisiPar_fkey" FOREIGN KEY ("idSaisiPar") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Un versement de zero n'est pas un versement, et un montant negatif serait un
-- remboursement en sens inverse : un autre geste, avec son propre motif.
ALTER TABLE "reglements_assureur"
  ADD CONSTRAINT "reglements_assureur_montant_positif" CHECK ("montantGnf" > 0);

-- Une periode qui se termine avant de commencer rendrait « ce qui reste du »
-- faux sans que rien ne le signale.
ALTER TABLE "reglements_assureur"
  ADD CONSTRAINT "reglements_assureur_periode_ordonnee" CHECK ("periodeFin" >= "periodeDebut");

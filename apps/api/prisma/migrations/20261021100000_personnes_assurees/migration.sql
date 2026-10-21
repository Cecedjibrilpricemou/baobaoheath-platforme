-- Lot assurance : fiche d'identite des personnes assurees (piece et photo),
-- tenue par chaque compagnie, et trace de la comparaison de la photo au
-- comptoir.

-- AlterTable
ALTER TABLE "ventes_comptoir" ADD COLUMN     "photoCompareeAuComptoir" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "personnes_assurees" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenoms" TEXT NOT NULL,
    "sexe" TEXT NOT NULL,
    "dateNaissance" DATE NOT NULL,
    "lieuNaissance" TEXT NOT NULL,
    "nationalite" TEXT NOT NULL,
    "typePiece" "TypePieceIdentite" NOT NULL,
    "numeroPiece" TEXT NOT NULL,
    "dateDelivrancePiece" DATE,
    "dateExpirationPiece" DATE,
    "telephone" TEXT NOT NULL,
    "adresse" TEXT,
    "photo" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifieLe" TIMESTAMP(3) NOT NULL,
    "idAssureur" TEXT NOT NULL,
    "idPatient" TEXT NOT NULL,
    "idSaisiePar" TEXT,

    CONSTRAINT "personnes_assurees_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "personnes_assurees_idAssureur_nom_idx" ON "personnes_assurees"("idAssureur", "nom");

-- CreateIndex
CREATE UNIQUE INDEX "personnes_assurees_idAssureur_idPatient_key" ON "personnes_assurees"("idAssureur", "idPatient");

-- CreateIndex
CREATE UNIQUE INDEX "personnes_assurees_idAssureur_typePiece_numeroPiece_key" ON "personnes_assurees"("idAssureur", "typePiece", "numeroPiece");

-- AddForeignKey
ALTER TABLE "personnes_assurees" ADD CONSTRAINT "personnes_assurees_idAssureur_fkey" FOREIGN KEY ("idAssureur") REFERENCES "assureurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personnes_assurees" ADD CONSTRAINT "personnes_assurees_idPatient_fkey" FOREIGN KEY ("idPatient") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personnes_assurees" ADD CONSTRAINT "personnes_assurees_idSaisiePar_fkey" FOREIGN KEY ("idSaisiePar") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;


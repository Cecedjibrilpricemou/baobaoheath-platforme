-- P3 / EF-05-05, EF-05-06 : securite de prescription.
--
-- Purement additive : aucune colonne existante n'est touchee, aucune donnee
-- deplacee. Les ordonnances deja emises restent telles quelles, sans alerte
-- enregistree — ce qui est exact, aucune ne leur a ete presentee.
--
--   medicaments.codeAtc            classe ATC, pour rapprocher deux
--                                  specialites de la meme famille
--   medicaments.contreIndications  texte libre tant que le referentiel
--                                  national (decision D6) n'est pas arrete
--   lignes_ordonnance.alertes      ce qui a ete montre au prescripteur, fige
--   lignes_ordonnance.motifDepassement  pourquoi il est passe outre
--   interactions_medicaments       couple ordonne (dciA < dciB) : une paire
--                                  ne peut pas exister deux fois

-- CreateEnum
CREATE TYPE "NiveauInteraction" AS ENUM ('PRECAUTION', 'ASSOCIATION_DECONSEILLEE', 'CONTRE_INDICATION');

-- AlterTable
ALTER TABLE "lignes_ordonnance" ADD COLUMN     "alertes" JSONB,
ADD COLUMN     "motifDepassement" TEXT;

-- AlterTable
ALTER TABLE "medicaments" ADD COLUMN     "codeAtc" TEXT,
ADD COLUMN     "contreIndications" TEXT[];

-- CreateTable
CREATE TABLE "interactions_medicaments" (
    "id" TEXT NOT NULL,
    "dciA" TEXT NOT NULL,
    "dciB" TEXT NOT NULL,
    "niveau" "NiveauInteraction" NOT NULL,
    "description" TEXT NOT NULL,
    "conduite" TEXT,
    "source" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interactions_medicaments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "interactions_medicaments_dciA_idx" ON "interactions_medicaments"("dciA");

-- CreateIndex
CREATE INDEX "interactions_medicaments_dciB_idx" ON "interactions_medicaments"("dciB");

-- CreateIndex
CREATE UNIQUE INDEX "interactions_medicaments_dciA_dciB_key" ON "interactions_medicaments"("dciA", "dciB");

-- CreateIndex
CREATE INDEX "medicaments_codeAtc_idx" ON "medicaments"("codeAtc");

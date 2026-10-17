-- CreateEnum
CREATE TYPE "ModeEchangeAssureur" AS ENUM ('MANUEL', 'PORTAIL', 'API');
-- CreateEnum
CREATE TYPE "StatutContrat" AS ENUM ('ACTIF', 'SUSPENDU', 'RESILIE');
-- AlterEnum
ALTER TYPE "TypeStructure" ADD VALUE 'ASSURANCE';
-- AlterTable
ALTER TABLE "lignes_vente" ADD COLUMN     "couvert" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "montantAssureGnf" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "motifExclusion" TEXT,
ADD COLUMN     "tauxAppliquePourcent" INTEGER NOT NULL DEFAULT 0;
-- AlterTable
ALTER TABLE "ventes_comptoir" ADD COLUMN     "idContratAssurance" TEXT,
ADD COLUMN     "montantAssureGnf" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "montantPatientGnf" INTEGER NOT NULL DEFAULT 0;
-- CreateTable
CREATE TABLE "assureurs" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "telephone" TEXT,
    "email" TEXT,
    "estActif" BOOLEAN NOT NULL DEFAULT true,
    "modeEchange" "ModeEchangeAssureur" NOT NULL DEFAULT 'MANUEL',
    "idStructure" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifieLe" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "assureurs_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "contrats_assurance" (
    "id" TEXT NOT NULL,
    "numeroPolice" TEXT NOT NULL,
    "tauxBasePourcent" INTEGER NOT NULL DEFAULT 80,
    "plafondAnnuelGnf" INTEGER NOT NULL DEFAULT 0,
    "franchiseGnf" INTEGER NOT NULL DEFAULT 0,
    "dateEffet" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3),
    "carenceJours" INTEGER NOT NULL DEFAULT 0,
    "statut" "StatutContrat" NOT NULL DEFAULT 'ACTIF',
    "idAssureur" TEXT NOT NULL,
    "idPatient" TEXT NOT NULL,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifieLe" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "contrats_assurance_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "regles_couverture" (
    "id" TEXT NOT NULL,
    "categorie" "CategorieProduit" NOT NULL,
    "exclu" BOOLEAN NOT NULL DEFAULT false,
    "tauxPourcent" INTEGER,
    "plafondLigneGnf" INTEGER NOT NULL DEFAULT 0,
    "dateEffet" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idAssureur" TEXT NOT NULL,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "regles_couverture_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "controles_eligibilite" (
    "id" TEXT NOT NULL,
    "eligible" BOOLEAN NOT NULL,
    "motif" TEXT,
    "numeroPolice" TEXT,
    "tauxBasePourcent" INTEGER,
    "idContrat" TEXT,
    "idPatient" TEXT NOT NULL,
    "idStructure" TEXT NOT NULL,
    "idControlePar" TEXT NOT NULL,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "controles_eligibilite_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE UNIQUE INDEX "assureurs_code_key" ON "assureurs"("code");
-- CreateIndex
CREATE UNIQUE INDEX "assureurs_idStructure_key" ON "assureurs"("idStructure");
-- CreateIndex
CREATE INDEX "contrats_assurance_idPatient_statut_idx" ON "contrats_assurance"("idPatient", "statut");
-- CreateIndex
CREATE UNIQUE INDEX "contrats_assurance_idAssureur_numeroPolice_key" ON "contrats_assurance"("idAssureur", "numeroPolice");
-- CreateIndex
CREATE INDEX "regles_couverture_idAssureur_categorie_dateEffet_idx" ON "regles_couverture"("idAssureur", "categorie", "dateEffet");
-- CreateIndex
CREATE INDEX "controles_eligibilite_idPatient_creeLe_idx" ON "controles_eligibilite"("idPatient", "creeLe" DESC);
-- CreateIndex
CREATE INDEX "controles_eligibilite_idStructure_creeLe_idx" ON "controles_eligibilite"("idStructure", "creeLe" DESC);
-- AddForeignKey
ALTER TABLE "ventes_comptoir" ADD CONSTRAINT "ventes_comptoir_idContratAssurance_fkey" FOREIGN KEY ("idContratAssurance") REFERENCES "contrats_assurance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "assureurs" ADD CONSTRAINT "assureurs_idStructure_fkey" FOREIGN KEY ("idStructure") REFERENCES "structures"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "contrats_assurance" ADD CONSTRAINT "contrats_assurance_idAssureur_fkey" FOREIGN KEY ("idAssureur") REFERENCES "assureurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "contrats_assurance" ADD CONSTRAINT "contrats_assurance_idPatient_fkey" FOREIGN KEY ("idPatient") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "regles_couverture" ADD CONSTRAINT "regles_couverture_idAssureur_fkey" FOREIGN KEY ("idAssureur") REFERENCES "assureurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "controles_eligibilite" ADD CONSTRAINT "controles_eligibilite_idContrat_fkey" FOREIGN KEY ("idContrat") REFERENCES "contrats_assurance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "controles_eligibilite" ADD CONSTRAINT "controles_eligibilite_idPatient_fkey" FOREIGN KEY ("idPatient") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "controles_eligibilite" ADD CONSTRAINT "controles_eligibilite_idStructure_fkey" FOREIGN KEY ("idStructure") REFERENCES "structures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "controles_eligibilite" ADD CONSTRAINT "controles_eligibilite_idControlePar_fkey" FOREIGN KEY ("idControlePar") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ------------------------------------------------------------------
-- Reprise des ventes existantes.
--
-- `montantPatientGnf` arrive avec un defaut de 0, alors qu'une vente sans
-- assurance a toujours ete payee entierement par le client. Sans cette
-- reprise, la contrainte ci-dessous refuserait chaque vente deja enregistree.
-- ------------------------------------------------------------------
UPDATE "ventes_comptoir"
   SET "montantPatientGnf" = "montantNetGnf"
 WHERE "montantAssureGnf" = 0 AND "montantPatientGnf" = 0;

-- ------------------------------------------------------------------
-- Les invariants d'argent et de tracabilite, en contraintes.
--
-- Un reste a charge faux ne se remarque qu'au comptoir, devant le patient.
-- ------------------------------------------------------------------

-- Ce que paie le patient est exactement ce que l'assureur ne prend pas.
ALTER TABLE "ventes_comptoir"
  ADD CONSTRAINT "ventes_comptoir_part_assureur_coherente" CHECK (
    "montantAssureGnf" >= 0
    AND "montantAssureGnf" <= "montantNetGnf"
    AND "montantPatientGnf" = "montantNetGnf" - "montantAssureGnf"
  );

-- Une ligne non couverte ne peut rien faire prendre a l'assureur, et un taux
-- vit entre 0 et 100.
ALTER TABLE "lignes_vente"
  ADD CONSTRAINT "lignes_vente_couverture_coherente" CHECK (
    "tauxAppliquePourcent" BETWEEN 0 AND 100
    AND "montantAssureGnf" >= 0
    AND "montantAssureGnf" <= "montantGnf"
    AND ("couvert" OR ("montantAssureGnf" = 0 AND "tauxAppliquePourcent" = 0))
  );

ALTER TABLE "contrats_assurance"
  ADD CONSTRAINT "contrats_assurance_valeurs_coherentes" CHECK (
    "tauxBasePourcent" BETWEEN 0 AND 100
    AND "plafondAnnuelGnf" >= 0
    AND "franchiseGnf" >= 0
    AND "carenceJours" >= 0
    AND ("dateFin" IS NULL OR "dateFin" > "dateEffet")
  );

-- Une categorie exclue n'a pas de taux : porter les deux serait contradictoire,
-- et laisserait le calcul decider lequel l'emporte.
ALTER TABLE "regles_couverture"
  ADD CONSTRAINT "regles_couverture_coherente" CHECK (
    "plafondLigneGnf" >= 0
    AND ("tauxPourcent" IS NULL OR "tauxPourcent" BETWEEN 0 AND 100)
    AND (NOT "exclu" OR "tauxPourcent" IS NULL)
  );

-- Un refus d'eligibilite sans motif n'est pas opposable : le comptoir n'aurait
-- rien a expliquer au patient (addendum, point 5.1).
ALTER TABLE "controles_eligibilite"
  ADD CONSTRAINT "controles_eligibilite_refus_motive" CHECK (
    "eligible" OR "motif" IS NOT NULL
  );

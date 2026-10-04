-- Fusion de dossiers patients (EF-01-06).
--
-- L'operation la plus dangereuse du produit : fusionner deux personnes
-- distinctes melange leurs dossiers medicaux. L'allergie de l'une devient
-- celle de l'autre, et personne ne s'en apercoit avant une prescription.
--
-- Ce fichier pose les garde-fous qui ne doivent dependre d'aucun appelant.

-- CreateEnum
CREATE TYPE "StatutFusion" AS ENUM ('ACTIVE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "TypeOperationFusion" AS ENUM ('DEPLACEMENT', 'RESTRICTION_CONSENTEMENT');

-- AlterTable
ALTER TABLE "patients" ADD COLUMN     "fusionneLe" TIMESTAMP(3),
ADD COLUMN     "idFusionneDans" TEXT;

-- CreateTable
CREATE TABLE "fusions_dossier" (
    "id" TEXT NOT NULL,
    "motif" TEXT NOT NULL,
    "statut" "StatutFusion" NOT NULL DEFAULT 'ACTIVE',
    "idPrincipal" TEXT NOT NULL,
    "idAbsorbe" TEXT NOT NULL,
    "idFusionnePar" TEXT NOT NULL,
    "fusionneLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "motifAnnulation" TEXT,
    "idAnnuleePar" TEXT,
    "annuleeLe" TIMESTAMP(3),

    CONSTRAINT "fusions_dossier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lignes_fusion" (
    "id" TEXT NOT NULL,
    "idFusion" TEXT NOT NULL,
    "tableCible" TEXT NOT NULL,
    "idLigne" TEXT NOT NULL,
    "operation" "TypeOperationFusion" NOT NULL,
    "valeurAvant" JSONB,

    CONSTRAINT "lignes_fusion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fusions_dossier_idPrincipal_fusionneLe_idx" ON "fusions_dossier"("idPrincipal", "fusionneLe");

-- CreateIndex
CREATE INDEX "fusions_dossier_idAbsorbe_idx" ON "fusions_dossier"("idAbsorbe");

-- CreateIndex
CREATE INDEX "fusions_dossier_statut_fusionneLe_idx" ON "fusions_dossier"("statut", "fusionneLe");

-- CreateIndex
CREATE INDEX "lignes_fusion_idFusion_idx" ON "lignes_fusion"("idFusion");

-- AddForeignKey
ALTER TABLE "fusions_dossier" ADD CONSTRAINT "fusions_dossier_idPrincipal_fkey" FOREIGN KEY ("idPrincipal") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fusions_dossier" ADD CONSTRAINT "fusions_dossier_idAbsorbe_fkey" FOREIGN KEY ("idAbsorbe") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fusions_dossier" ADD CONSTRAINT "fusions_dossier_idFusionnePar_fkey" FOREIGN KEY ("idFusionnePar") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fusions_dossier" ADD CONSTRAINT "fusions_dossier_idAnnuleePar_fkey" FOREIGN KEY ("idAnnuleePar") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lignes_fusion" ADD CONSTRAINT "lignes_fusion_idFusion_fkey" FOREIGN KEY ("idFusion") REFERENCES "fusions_dossier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_idFusionneDans_fkey" FOREIGN KEY ("idFusionneDans") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────
-- Les invariants que Prisma ne sait pas exprimer
-- ─────────────────────────────────────────────────────────────────────

-- Un dossier ne se fusionne pas avec lui-meme. Sans cela, une faute de copie
-- d'identifiant deplacerait toutes les lignes d'un dossier vers lui-meme et
-- l'annulation n'aurait plus de sens.
ALTER TABLE "fusions_dossier"
  ADD CONSTRAINT "fusions_dossier_pas_sur_soi"
  CHECK ("idPrincipal" <> "idAbsorbe");

-- Un motif qui ne dit rien ne permet pas de contester la fusion plus tard.
-- Dix caracteres, comme pour une suspension de compte et une reponse RGPD.
ALTER TABLE "fusions_dossier"
  ADD CONSTRAINT "fusions_dossier_motif_dit_quelque_chose"
  CHECK (length(btrim("motif")) >= 10);

-- Une fusion annulee porte sa date et son motif, et une fusion active n'en a
-- pas. L'etat et ses preuves ne peuvent pas diverger.
--
-- `idAnnuleePar` est volontairement **hors** de cette contrainte : sa cle
-- etrangere est `ON DELETE SET NULL`, et l'exiger ici rendrait indeletable
-- tout agent ayant annule une fusion. Les deux se contrediraient — c'est
-- exactement l'erreur commise le 2026-10-04 sur l'identito-vigilance.
ALTER TABLE "fusions_dossier"
  ADD CONSTRAINT "fusions_dossier_annulation_motivee"
  CHECK (
    ("statut" = 'ANNULEE') = ("annuleeLe" IS NOT NULL AND "motifAnnulation" IS NOT NULL)
  );

-- Un dossier fusionne porte sa date, et un dossier qui ne l'est pas n'en a
-- pas. Et il ne se fusionne pas dans lui-meme.
ALTER TABLE "patients"
  ADD CONSTRAINT "patients_fusion_coherente"
  CHECK (
    ("idFusionneDans" IS NULL) = ("fusionneLe" IS NULL)
    AND ("idFusionneDans" IS NULL OR "idFusionneDans" <> "id")
  );

-- ─────────────────────────────────────────────────────────────────────
-- Pas de chaine de fusion
-- ─────────────────────────────────────────────────────────────────────
--
-- A absorbe par B, lui-meme absorbe par C : la lecture devrait suivre une
-- chaine de longueur inconnue, et l'annulation de la premiere fusion
-- rendrait des lignes a un dossier qui n'existe plus comme tel. Trois
-- doublons se traitent tres bien sans chaine : A absorbe B, puis A absorbe C.
--
-- Une contrainte CHECK ne peut pas regarder une autre ligne. Un declencheur,
-- si.
CREATE OR REPLACE FUNCTION fusion_sans_chaine() RETURNS TRIGGER AS $$
BEGIN
  IF NEW."idFusionneDans" IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM "patients"
    WHERE "id" = NEW."idFusionneDans" AND "idFusionneDans" IS NOT NULL
  ) THEN
    RAISE EXCEPTION
      'EF-01-06 : le dossier % est lui-meme fusionne ailleurs. Fusionnez dans le dossier qui survit.',
      NEW."idFusionneDans";
  END IF;

  IF EXISTS (
    SELECT 1 FROM "patients" WHERE "idFusionneDans" = NEW."id"
  ) THEN
    RAISE EXCEPTION
      'EF-01-06 : le dossier % absorbe deja un autre dossier, il ne peut pas etre absorbe a son tour.',
      NEW."id";
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_patients_fusion_sans_chaine
  BEFORE INSERT OR UPDATE OF "idFusionneDans" ON "patients"
  FOR EACH ROW EXECUTE FUNCTION fusion_sans_chaine();

-- Retrouver vite les dossiers absorbes par un dossier donne : c'est la
-- lecture que fait tout ecran qui affiche un dossier fusionne.
CREATE INDEX "patients_fusionne_dans_idx" ON "patients"("idFusionneDans")
  WHERE "idFusionneDans" IS NOT NULL;

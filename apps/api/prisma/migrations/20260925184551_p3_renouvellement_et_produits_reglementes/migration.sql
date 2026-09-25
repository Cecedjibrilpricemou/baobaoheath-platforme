-- P3 / EF-05-09, EF-05-12 : renouvellement et produits a circuit reglemente.
--
-- Purement additive. Les valeurs par defaut decrivent l'existant : aucune
-- ordonnance deja emise n'est renouvelable, aucun medicament deja saisi n'est
-- reglemente. Rien ne change de comportement retroactivement.

-- AlterTable
ALTER TABLE "medicaments" ADD COLUMN     "estReglemente" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ordonnances" ADD COLUMN     "renouvellementsAutorises" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "renouvellementsUtilises" INTEGER NOT NULL DEFAULT 0;

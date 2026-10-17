-- AlterTable
ALTER TABLE "utilisateurs" ADD COLUMN     "idOrdreVerifiePar" TEXT,
ADD COLUMN     "numeroOrdre" TEXT,
ADD COLUMN     "ordreVerifieLe" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "utilisateurs" ADD CONSTRAINT "utilisateurs_idOrdreVerifiePar_fkey" FOREIGN KEY ("idOrdreVerifiePar") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Numero d'ordre professionnel (EF-01-08).
--
-- On ne certifie pas avoir verifie un numero qui n'existe pas. `idOrdreVerifiePar`
-- reste hors de la contrainte : sa cle etrangere est ON DELETE SET NULL, et
-- l'exiger ici rendrait indeletable tout administrateur ayant verifie un compte.
ALTER TABLE "utilisateurs"
  ADD CONSTRAINT "utilisateurs_ordre_verifie_fonde"
  CHECK ("ordreVerifieLe" IS NULL OR length(btrim("numeroOrdre")) >= 3);

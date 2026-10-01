-- Le catalogue accepte des articles non medicamenteux, et sa categorie passe
-- en liste fermee (decision du 2026-10-01).
--
-- Prisma proposait deux pertes :
--   ADD COLUMN "libelle" TEXT NOT NULL   -- echoue sur une table peuplee
--   DROP COLUMN "categorie"              -- jetterait « Antalgique »
-- D'ou cette migration ecrite a la main, qui reprend les donnees avant de
-- toucher aux colonnes.

CREATE TYPE "CategorieProduit" AS ENUM (
  'MEDICAMENT', 'LAIT_INFANTILE', 'COMPLEMENT_ALIMENTAIRE', 'COSMETIQUE',
  'HYGIENE', 'PARAPHARMACIE', 'DISPOSITIF_MEDICAL', 'AUTRE'
);

-- 1. Le nom d'affichage, d'abord nullable pour pouvoir le remplir.
ALTER TABLE "medicaments" ADD COLUMN "libelle" TEXT;
UPDATE "medicaments" SET "libelle" = COALESCE(NULLIF(TRIM("nomCommercial"), ''), "dci");
ALTER TABLE "medicaments" ALTER COLUMN "libelle" SET NOT NULL;

-- 2. La classe therapeutique recupere l'ancien texte libre, avant qu'on ne
--    reutilise le nom « categorie » pour l'enumeration.
ALTER TABLE "medicaments" ADD COLUMN "classeTherapeutique" TEXT;
UPDATE "medicaments" SET "classeTherapeutique" = "categorie";

ALTER TABLE "medicaments" DROP COLUMN "categorie";
ALTER TABLE "medicaments"
  ADD COLUMN "categorie" "CategorieProduit" NOT NULL DEFAULT 'MEDICAMENT';

-- 3. Hors medicament, ces trois colonnes n'ont pas d'objet : un lait infantile
--    n'a ni DCI, ni forme galenique, ni dosage.
ALTER TABLE "medicaments" ALTER COLUMN "dci" DROP NOT NULL;
ALTER TABLE "medicaments" ALTER COLUMN "forme" DROP NOT NULL;
ALTER TABLE "medicaments" ALTER COLUMN "dosage" DROP NOT NULL;

-- 4. L'invariant devient une contrainte, pas une convention : un MEDICAMENT
--    porte toujours sa DCI, sa forme et son dosage. Le controle d'allergie et
--    la recherche d'interaction comparent sur la DCI ; une ligne de medicament
--    sans DCI les traverserait en silence.
ALTER TABLE "medicaments"
  ADD CONSTRAINT "medicaments_medicament_complet" CHECK (
    "categorie" <> 'MEDICAMENT'
    OR ("dci" IS NOT NULL AND "forme" IS NOT NULL AND "dosage" IS NOT NULL)
  );

CREATE INDEX "medicaments_categorie_idx" ON "medicaments"("categorie");

-- Les pieces d'agrement des structures privees.
--
-- **Ecrite a la main, volontairement.** `migrate diff --from-config-datasource`
-- compare au contenu reel de la base, qui porte la migration de la branche
-- `feat/plateau-technique-labo`, non fusionnee. Il proposait donc
-- `DROP TABLE plateaux_techniques` et `DROP TABLE structures_conseillees` :
-- du SQL destructeur ne appartenant pas a ce changement. Seules les lignes
-- ci-dessous en relevent.

-- CreateEnum
CREATE TYPE "TypePieceAgrement" AS ENUM ('AGREMENT_CREATION', 'AGREMENT_EXPLOITATION', 'DIPLOME_RESPONSABLE', 'INSCRIPTION_ORDRE', 'AGREMENT_ASSURANCE', 'AUTRE');

-- AlterTable
-- Nullable : les structures deja en base n'ont rien de tout cela, et une
-- colonne NOT NULL rendrait la migration inapplicable. L'exigence se tient a
-- la creation, cote application, pas par une contrainte qui invaliderait
-- l'existant.
ALTER TABLE "structures" ADD COLUMN     "lieuAutorise" TEXT,
ADD COLUMN     "numeroAgrementCreation" TEXT,
ADD COLUMN     "numeroAgrementExploitation" TEXT,
ADD COLUMN     "rccm" TEXT;

-- CreateTable
CREATE TABLE "pieces_agrement" (
    "id" TEXT NOT NULL,
    "type" "TypePieceAgrement" NOT NULL,
    "fichier" TEXT NOT NULL,
    "taille" INTEGER NOT NULL,
    "libelle" TEXT,
    "idStructure" TEXT NOT NULL,
    "idDeposePar" TEXT,
    "deposeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pieces_agrement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pieces_agrement_idStructure_type_idx" ON "pieces_agrement"("idStructure", "type");

-- Une seule piece par type et par structure : redeposer remplace. `AUTRE`
-- echappe a la regle, sinon on ne pourrait en deposer qu'une seule, et c'est
-- precisement le type fourre-tout.
CREATE UNIQUE INDEX "pieces_agrement_un_par_type" ON "pieces_agrement"("idStructure", "type")
    WHERE "type" <> 'AUTRE';

-- Un fichier de taille nulle est un televersement rate, pas une piece.
--
-- Ecrit `IS NULL OR` par principe meme si la colonne est NOT NULL : en logique
-- trois valeurs un CHECK qui vaut NULL **accepte** la ligne, et la colonne
-- pourrait devenir nullable un jour sans que personne ne relise ce CHECK.
ALTER TABLE "pieces_agrement" ADD CONSTRAINT "pieces_agrement_taille_positive"
    CHECK ("taille" IS NULL OR "taille" > 0);

-- Le nom du fichier ne doit jamais pouvoir sortir du dossier prive. Le service
-- le valide aussi, mais une ecriture directe en base contournerait le service.
ALTER TABLE "pieces_agrement" ADD CONSTRAINT "pieces_agrement_fichier_sans_chemin"
    CHECK ("fichier" ~ '^[A-Za-z0-9_-]+\.pdf$');

-- `AUTRE` ne dit rien de lui-meme : sans libelle, la piece est illisible dans
-- la liste. Les types nommes n'en ont pas besoin.
ALTER TABLE "pieces_agrement" ADD CONSTRAINT "pieces_agrement_autre_a_un_libelle"
    CHECK ("type" <> 'AUTRE' OR ("libelle" IS NOT NULL AND length(btrim("libelle")) > 0));

-- AddForeignKey
ALTER TABLE "pieces_agrement" ADD CONSTRAINT "pieces_agrement_idStructure_fkey" FOREIGN KEY ("idStructure") REFERENCES "structures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pieces_agrement" ADD CONSTRAINT "pieces_agrement_idDeposePar_fkey" FOREIGN KEY ("idDeposePar") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

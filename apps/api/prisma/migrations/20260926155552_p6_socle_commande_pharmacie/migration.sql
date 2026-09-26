-- P6 / EF-07 : socle du parcours commande pharmacie.
-- Voir docs/PARCOURS-COMMANDE-LIVRAISON.md
--
-- Purement additive. Les defauts decrivent l'existant : aucune structure n'est
-- partenaire, aucun patient n'a de quartier renseigne. Tant que ces deux
-- champs ne sont pas remplis, l'appel aux pharmacies ne trouvera personne — ce
-- qui est le comportement correct, pas un bug.
--
--   Role.LIVREUR                  le taxi-moto existe enfin dans le systeme
--   patients.commune / quartier   la maille reelle de la recherche
--   structures.commune / quartier idem cote pharmacie
--   structures.estPartenaire      seules les conventionnees sont sollicitees
--   commandes                     le document, avec son verrou d'attribution
--                                 (idPharmacie nul = encore a prendre)
--   reponses_pharmacie            la trace de qui a repondu quoi, y compris
--                                 les refus : c'est ce qui permet de dire au
--                                 patient « trois pharmacies, aucune n'avait
--                                 tout »

-- CreateEnum
CREATE TYPE "StatutCommande" AS ENUM ('RECHERCHE_PHARMACIE', 'PRISE_EN_CHARGE', 'SANS_PHARMACIE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "ModeRemise" AS ENUM ('RETRAIT_PHARMACIE', 'LIVRAISON');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'LIVREUR';

-- AlterTable
ALTER TABLE "patients" ADD COLUMN     "commune" TEXT,
ADD COLUMN     "quartier" TEXT;

-- AlterTable
ALTER TABLE "structures" ADD COLUMN     "commune" TEXT,
ADD COLUMN     "estPartenaire" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "partenaireDepuis" TIMESTAMP(3),
ADD COLUMN     "quartier" TEXT;

-- CreateTable
CREATE TABLE "commandes" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "statut" "StatutCommande" NOT NULL DEFAULT 'RECHERCHE_PHARMACIE',
    "modeRemise" "ModeRemise",
    "quartierRecherche" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifieLe" TIMESTAMP(3) NOT NULL,
    "idOrdonnance" TEXT NOT NULL,
    "idPharmacie" TEXT,
    "priseEnChargeLe" TIMESTAMP(3),

    CONSTRAINT "commandes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reponses_pharmacie" (
    "id" TEXT NOT NULL,
    "aTousLesProduits" BOOLEAN NOT NULL,
    "repondueLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retracteeLe" TIMESTAMP(3),
    "idCommande" TEXT NOT NULL,
    "idStructure" TEXT NOT NULL,

    CONSTRAINT "reponses_pharmacie_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "commandes_numero_key" ON "commandes"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "commandes_idOrdonnance_key" ON "commandes"("idOrdonnance");

-- CreateIndex
CREATE INDEX "commandes_statut_idx" ON "commandes"("statut");

-- CreateIndex
CREATE INDEX "commandes_idPharmacie_idx" ON "commandes"("idPharmacie");

-- CreateIndex
CREATE INDEX "reponses_pharmacie_idCommande_idx" ON "reponses_pharmacie"("idCommande");

-- CreateIndex
CREATE UNIQUE INDEX "reponses_pharmacie_idCommande_idStructure_key" ON "reponses_pharmacie"("idCommande", "idStructure");

-- AddForeignKey
ALTER TABLE "commandes" ADD CONSTRAINT "commandes_idOrdonnance_fkey" FOREIGN KEY ("idOrdonnance") REFERENCES "ordonnances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commandes" ADD CONSTRAINT "commandes_idPharmacie_fkey" FOREIGN KEY ("idPharmacie") REFERENCES "structures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reponses_pharmacie" ADD CONSTRAINT "reponses_pharmacie_idCommande_fkey" FOREIGN KEY ("idCommande") REFERENCES "commandes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reponses_pharmacie" ADD CONSTRAINT "reponses_pharmacie_idStructure_fkey" FOREIGN KEY ("idStructure") REFERENCES "structures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

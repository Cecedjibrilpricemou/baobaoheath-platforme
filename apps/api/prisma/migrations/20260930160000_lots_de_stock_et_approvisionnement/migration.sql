-- Le stock se detaille en lots, et les entrees viennent d'une facture
-- (addendum du 2026-09-28, point 1.3).
--
-- ECRITE A LA MAIN A DESSEIN. `prisma migrate diff` placait
--     ALTER TABLE "stocks" DROP COLUMN "datePeremption";
-- EN PREMIER, avant meme que la table des lots existe : les dates de
-- peremption deja saisies auraient ete perdues. Ici la colonne n'est retiree
-- qu'apres que son contenu a ete repris dans un lot.

-- ── 1. Les nouvelles tables ─────────────────────────────────────────
CREATE TABLE "approvisionnements" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "numeroFacture" TEXT,
    "fournisseur" TEXT NOT NULL,
    "dateFacture" TIMESTAMP(3) NOT NULL,
    "justificatifUrl" TEXT,
    "montantTotalGnf" INTEGER NOT NULL DEFAULT 0,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idStructure" TEXT NOT NULL,
    "idSaisiPar" TEXT NOT NULL,
    CONSTRAINT "approvisionnements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "lots_stock" (
    "id" TEXT NOT NULL,
    "numeroLot" TEXT,
    "quantite" INTEGER NOT NULL,
    "quantiteRecue" INTEGER NOT NULL,
    "datePeremption" TIMESTAMP(3),
    "prixAchatGnf" INTEGER NOT NULL DEFAULT 0,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifieLe" TIMESTAMP(3) NOT NULL,
    "idStock" TEXT NOT NULL,
    "idApprovisionnement" TEXT,
    CONSTRAINT "lots_stock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "approvisionnements_numero_key" ON "approvisionnements"("numero");
CREATE INDEX "approvisionnements_idStructure_dateFacture_idx" ON "approvisionnements"("idStructure", "dateFacture" DESC);
CREATE INDEX "lots_stock_idStock_datePeremption_idx" ON "lots_stock"("idStock", "datePeremption");

ALTER TABLE "approvisionnements" ADD CONSTRAINT "approvisionnements_idStructure_fkey"
  FOREIGN KEY ("idStructure") REFERENCES "structures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "approvisionnements" ADD CONSTRAINT "approvisionnements_idSaisiPar_fkey"
  FOREIGN KEY ("idSaisiPar") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lots_stock" ADD CONSTRAINT "lots_stock_idStock_fkey"
  FOREIGN KEY ("idStock") REFERENCES "stocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lots_stock" ADD CONSTRAINT "lots_stock_idApprovisionnement_fkey"
  FOREIGN KEY ("idApprovisionnement") REFERENCES "approvisionnements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 2. Reprise de l'existant ────────────────────────────────────────
-- Chaque stock non vide devient un lot initial, qui garde sa date de
-- peremption. Sans facture d'origine : ces lots sont anterieurs au suivi des
-- approvisionnements, et inventer un fournisseur serait mentir.
INSERT INTO "lots_stock" ("id", "quantite", "quantiteRecue", "datePeremption", "idStock", "creeLe", "modifieLe")
SELECT
  gen_random_uuid()::text,
  s."quantite",
  s."quantite",
  s."datePeremption",
  s."id",
  now(),
  now()
FROM "stocks" s
WHERE s."quantite" > 0;

-- ── 3. La colonne peut partir : son contenu est dans les lots ───────
ALTER TABLE "stocks" DROP COLUMN "datePeremption";

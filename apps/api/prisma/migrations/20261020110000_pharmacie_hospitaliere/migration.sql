ALTER TABLE "structures"
ADD COLUMN "idStructureParente" TEXT;

CREATE INDEX "structures_idStructureParente_idx"
ON "structures"("idStructureParente");

ALTER TABLE "structures"
ADD CONSTRAINT "structures_idStructureParente_fkey"
FOREIGN KEY ("idStructureParente") REFERENCES "structures"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "structures_assureurs" (
    "id" TEXT NOT NULL,
    "idStructure" TEXT NOT NULL,
    "idAssureur" TEXT NOT NULL,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "structures_assureurs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "structures_assureurs_idStructure_idAssureur_key"
ON "structures_assureurs"("idStructure", "idAssureur");

CREATE INDEX "structures_assureurs_idAssureur_idx"
ON "structures_assureurs"("idAssureur");

ALTER TABLE "structures_assureurs"
ADD CONSTRAINT "structures_assureurs_idStructure_fkey"
FOREIGN KEY ("idStructure") REFERENCES "structures"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "structures_assureurs"
ADD CONSTRAINT "structures_assureurs_idAssureur_fkey"
FOREIGN KEY ("idAssureur") REFERENCES "assureurs"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

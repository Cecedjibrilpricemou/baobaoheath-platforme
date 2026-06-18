-- Add missing user flag used by the API.
ALTER TABLE "utilisateurs"
ADD COLUMN IF NOT EXISTS "doitChangerMotDePasse" BOOLEAN NOT NULL DEFAULT false;

-- Allow private pharmacies as health structures.
ALTER TYPE "TypeStructure" ADD VALUE IF NOT EXISTS 'PHARMACIE';

-- Older project migrations did not create the pharmacist profile table yet.
CREATE TABLE IF NOT EXISTS "profils_pharmacien" (
  "id" TEXT NOT NULL,
  "photoUrl" TEXT,
  "estResponsable" BOOLEAN NOT NULL DEFAULT false,
  "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "idUtilisateur" TEXT NOT NULL,
  "idStructure" TEXT,
  CONSTRAINT "profils_pharmacien_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "profils_pharmacien_idUtilisateur_key"
ON "profils_pharmacien"("idUtilisateur");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profils_pharmacien_idUtilisateur_fkey'
  ) THEN
    ALTER TABLE "profils_pharmacien"
    ADD CONSTRAINT "profils_pharmacien_idUtilisateur_fkey"
    FOREIGN KEY ("idUtilisateur") REFERENCES "utilisateurs"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profils_pharmacien_idStructure_fkey'
  ) THEN
    ALTER TABLE "profils_pharmacien"
    ADD CONSTRAINT "profils_pharmacien_idStructure_fkey"
    FOREIGN KEY ("idStructure") REFERENCES "structures"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Mark the main pharmacist account for a private pharmacy.
ALTER TABLE "profils_pharmacien"
ADD COLUMN IF NOT EXISTS "estResponsable" BOOLEAN NOT NULL DEFAULT false;

-- Pharmacy stock belongs to the pharmacy structure; ASC stock keeps idAsc.
ALTER TABLE "stocks"
ADD COLUMN IF NOT EXISTS "idStructure" TEXT;

ALTER TABLE "stocks"
ALTER COLUMN "idAsc" DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stocks_idStructure_fkey'
  ) THEN
    ALTER TABLE "stocks"
    ADD CONSTRAINT "stocks_idStructure_fkey"
    FOREIGN KEY ("idStructure") REFERENCES "structures"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "stocks_idStructure_idMedicament_key"
ON "stocks"("idStructure", "idMedicament");

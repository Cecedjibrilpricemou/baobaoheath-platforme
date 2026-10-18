ALTER TABLE "medicaments"
    ADD COLUMN IF NOT EXISTS "idStructure" TEXT;

CREATE INDEX IF NOT EXISTS "medicaments_idStructure_estActif_idx"
    ON "medicaments"("idStructure", "estActif");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'medicaments_idStructure_fkey'
          AND conrelid = '"medicaments"'::regclass
    ) THEN
        ALTER TABLE "medicaments"
            ADD CONSTRAINT "medicaments_idStructure_fkey"
            FOREIGN KEY ("idStructure") REFERENCES "structures"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

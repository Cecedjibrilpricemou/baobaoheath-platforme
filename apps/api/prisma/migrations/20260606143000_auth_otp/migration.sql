CREATE TABLE IF NOT EXISTS "auth_otp" (
  "id" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "expireLe" TIMESTAMP(3) NOT NULL,
  "tentatives" INTEGER NOT NULL DEFAULT 0,
  "maxTentatives" INTEGER NOT NULL DEFAULT 5,
  "utiliseLe" TIMESTAMP(3),
  "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "idUtilisateur" TEXT NOT NULL,
  CONSTRAINT "auth_otp_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "auth_otp_idUtilisateur_expireLe_idx"
ON "auth_otp"("idUtilisateur", "expireLe");

DO $$ BEGIN
  ALTER TABLE "auth_otp"
    ADD CONSTRAINT "auth_otp_idUtilisateur_fkey"
    FOREIGN KEY ("idUtilisateur") REFERENCES "utilisateurs"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

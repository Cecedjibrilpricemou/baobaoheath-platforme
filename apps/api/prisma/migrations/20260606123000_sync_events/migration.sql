DO $$ BEGIN
  CREATE TYPE "SyncOperation" AS ENUM ('CREATE', 'UPDATE', 'DELETE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "SyncMutationStatus" AS ENUM ('RECU', 'TRAITE', 'REJETE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "sync_events" (
  "id" TEXT NOT NULL,
  "version" SERIAL NOT NULL,
  "scope" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "operation" "SyncOperation" NOT NULL,
  "payload" JSONB,
  "idStructure" TEXT,
  "idUtilisateur" TEXT,
  "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sync_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "sync_events_version_key" ON "sync_events"("version");
CREATE INDEX IF NOT EXISTS "sync_events_scope_version_idx" ON "sync_events"("scope", "version");
CREATE INDEX IF NOT EXISTS "sync_events_idStructure_version_idx" ON "sync_events"("idStructure", "version");
CREATE INDEX IF NOT EXISTS "sync_events_idUtilisateur_version_idx" ON "sync_events"("idUtilisateur", "version");

DO $$ BEGIN
  ALTER TABLE "sync_events"
    ADD CONSTRAINT "sync_events_idUtilisateur_fkey"
    FOREIGN KEY ("idUtilisateur") REFERENCES "utilisateurs"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "sync_mutations" (
  "id" TEXT NOT NULL,
  "clientMutationId" TEXT NOT NULL,
  "deviceId" TEXT,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "operation" "SyncOperation" NOT NULL,
  "payload" JSONB NOT NULL,
  "baseVersion" INTEGER,
  "statut" "SyncMutationStatus" NOT NULL DEFAULT 'RECU',
  "erreur" TEXT,
  "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "traiteLe" TIMESTAMP(3),
  "idUtilisateur" TEXT NOT NULL,
  CONSTRAINT "sync_mutations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "sync_mutations_clientMutationId_key" ON "sync_mutations"("clientMutationId");
CREATE INDEX IF NOT EXISTS "sync_mutations_idUtilisateur_creeLe_idx" ON "sync_mutations"("idUtilisateur", "creeLe");
CREATE INDEX IF NOT EXISTS "sync_mutations_statut_creeLe_idx" ON "sync_mutations"("statut", "creeLe");

DO $$ BEGIN
  ALTER TABLE "sync_mutations"
    ADD CONSTRAINT "sync_mutations_idUtilisateur_fkey"
    FOREIGN KEY ("idUtilisateur") REFERENCES "utilisateurs"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

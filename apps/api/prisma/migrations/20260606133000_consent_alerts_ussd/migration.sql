DO $$ BEGIN
  CREATE TYPE "ConsentScope" AS ENUM ('DOSSIER_MEDICAL', 'FHIR_EXPORT', 'RAPPELS_SMS', 'RECHERCHE_ANONYMISEE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "UssdSessionStatus" AS ENUM ('ACTIVE', 'TERMINEE', 'EXPIREE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "NiveauAlerteEpidemique" AS ENUM ('ATTENTION', 'ALERTE', 'URGENCE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "consentements_patient" (
  "id" TEXT NOT NULL,
  "scope" "ConsentScope" NOT NULL,
  "actif" BOOLEAN NOT NULL DEFAULT true,
  "donneLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "retireLe" TIMESTAMP(3),
  "source" TEXT NOT NULL DEFAULT 'WEB',
  "commentaire" TEXT,
  "idPatient" TEXT NOT NULL,
  "idUtilisateur" TEXT NOT NULL,
  CONSTRAINT "consentements_patient_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "consentements_patient_idPatient_scope_key" ON "consentements_patient"("idPatient", "scope");
CREATE INDEX IF NOT EXISTS "consentements_patient_scope_actif_idx" ON "consentements_patient"("scope", "actif");

DO $$ BEGIN
  ALTER TABLE "consentements_patient"
    ADD CONSTRAINT "consentements_patient_idPatient_fkey"
    FOREIGN KEY ("idPatient") REFERENCES "patients"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "consentements_patient"
    ADD CONSTRAINT "consentements_patient_idUtilisateur_fkey"
    FOREIGN KEY ("idUtilisateur") REFERENCES "utilisateurs"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "alertes_epidemiologiques" (
  "id" TEXT NOT NULL,
  "pathologie" TEXT NOT NULL,
  "prefecture" TEXT NOT NULL,
  "nombre" INTEGER NOT NULL,
  "seuil" INTEGER NOT NULL,
  "niveau" "NiveauAlerteEpidemique" NOT NULL,
  "fenetreJours" INTEGER NOT NULL DEFAULT 30,
  "statut" TEXT NOT NULL DEFAULT 'ACTIVE',
  "dateDetection" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadonnees" JSONB,
  CONSTRAINT "alertes_epidemiologiques_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "alertes_epidemiologiques_pathologie_prefecture_fenetreJours_statut_key"
  ON "alertes_epidemiologiques"("pathologie", "prefecture", "fenetreJours", "statut");
CREATE INDEX IF NOT EXISTS "alertes_epidemiologiques_prefecture_statut_idx" ON "alertes_epidemiologiques"("prefecture", "statut");
CREATE INDEX IF NOT EXISTS "alertes_epidemiologiques_niveau_dateDetection_idx" ON "alertes_epidemiologiques"("niveau", "dateDetection");

CREATE TABLE IF NOT EXISTS "ussd_sessions" (
  "id" TEXT NOT NULL,
  "telephone" TEXT NOT NULL,
  "etape" TEXT NOT NULL DEFAULT 'ACCUEIL',
  "statut" "UssdSessionStatus" NOT NULL DEFAULT 'ACTIVE',
  "donnees" JSONB,
  "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expireLe" TIMESTAMP(3) NOT NULL,
  "modifieLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "idUtilisateur" TEXT,
  CONSTRAINT "ussd_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ussd_sessions_telephone_statut_idx" ON "ussd_sessions"("telephone", "statut");
CREATE INDEX IF NOT EXISTS "ussd_sessions_expireLe_idx" ON "ussd_sessions"("expireLe");

DO $$ BEGIN
  ALTER TABLE "ussd_sessions"
    ADD CONSTRAINT "ussd_sessions_idUtilisateur_fkey"
    FOREIGN KEY ("idUtilisateur") REFERENCES "utilisateurs"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

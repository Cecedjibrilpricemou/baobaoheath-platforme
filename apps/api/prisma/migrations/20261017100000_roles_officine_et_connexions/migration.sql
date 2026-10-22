CREATE TYPE "RoleOfficine" AS ENUM ('TITULAIRE', 'ADJOINT', 'PREPARATEUR', 'CAISSIER');

ALTER TABLE "profils_pharmacien"
    ADD COLUMN "roleOfficine" "RoleOfficine" NOT NULL DEFAULT 'ADJOINT',
    ADD COLUMN "roleOfficineTemporaire" "RoleOfficine",
    ADD COLUMN "roleOfficineExpireLe" TIMESTAMP(3);

-- Preserve the existing responsible-pharmacist assignment as the officine owner.
UPDATE "profils_pharmacien"
SET "roleOfficine" = 'TITULAIRE'
WHERE "estResponsable" = TRUE;

CREATE TYPE "TypeEvenementConnexion" AS ENUM (
    'CONNEXION_REUSSIE',
    'ECHEC_AUTHENTIFICATION',
    'ECHEC_CODE',
    'DECONNEXION'
);

CREATE TABLE "evenements_connexion" (
    "id" TEXT NOT NULL,
    "type" "TypeEvenementConnexion" NOT NULL,
    "ipAdresse" TEXT,
    "userAgent" TEXT,
    "identifiantHash" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idUtilisateur" TEXT,
    "idStructure" TEXT,
    CONSTRAINT "evenements_connexion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "evenements_connexion_idStructure_creeLe_idx"
    ON "evenements_connexion"("idStructure", "creeLe");
CREATE INDEX "evenements_connexion_idUtilisateur_creeLe_idx"
    ON "evenements_connexion"("idUtilisateur", "creeLe");

ALTER TABLE "evenements_connexion"
    ADD CONSTRAINT "evenements_connexion_idUtilisateur_fkey"
    FOREIGN KEY ("idUtilisateur") REFERENCES "utilisateurs"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Lot assurance : contrats collectifs d'entreprise, adhesions par
-- beneficiaire, cartes a QR opaque et regles de taux propres a chaque police.

ALTER TYPE "StatutContrat" ADD VALUE IF NOT EXISTS 'EXPIRE';

-- Contrat individuel : jeton de carte et periode de grace.
-- Les contrats existants recoivent un jeton aleatoire ; le defaut est retire
-- ensuite, car le service genere lui-meme un jeton de 32 octets.
ALTER TABLE "contrats_assurance"
ADD COLUMN "jetonCarte" TEXT NOT NULL DEFAULT (md5(random()::TEXT || clock_timestamp()::TEXT) || md5(random()::TEXT || clock_timestamp()::TEXT)),
ADD COLUMN "periodeGraceJours" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "contrats_assurance" ALTER COLUMN "jetonCarte" DROP DEFAULT;

CREATE UNIQUE INDEX "contrats_assurance_jetonCarte_key"
ON "contrats_assurance"("jetonCarte");

CREATE TABLE "entreprises_assurees" (
    "id" TEXT NOT NULL,
    "raisonSociale" TEXT NOT NULL,
    "identifiantLegal" TEXT,
    "telephone" TEXT,
    "email" TEXT,
    "estActive" BOOLEAN NOT NULL DEFAULT true,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifieLe" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "entreprises_assurees_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "entreprises_assurees_raisonSociale_idx"
ON "entreprises_assurees"("raisonSociale");
CREATE UNIQUE INDEX "entreprises_assurees_identifiantLegal_key"
ON "entreprises_assurees"("identifiantLegal");

CREATE TABLE "contrats_collectifs_assurance" (
    "id" TEXT NOT NULL,
    "numeroContrat" TEXT NOT NULL,
    "nomRegime" TEXT NOT NULL,
    "tauxBasePourcent" INTEGER NOT NULL DEFAULT 80,
    "plafondAnnuelGnf" INTEGER NOT NULL DEFAULT 0,
    "franchiseGnf" INTEGER NOT NULL DEFAULT 0,
    "dateEffet" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3),
    "carenceJours" INTEGER NOT NULL DEFAULT 0,
    "periodeGraceJours" INTEGER NOT NULL DEFAULT 0,
    "statut" "StatutContrat" NOT NULL DEFAULT 'ACTIF',
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifieLe" TIMESTAMP(3) NOT NULL,
    "idEntreprise" TEXT NOT NULL,
    "idAssureur" TEXT NOT NULL,
    CONSTRAINT "contrats_collectifs_assurance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "contrats_collectifs_assurance_idAssureur_numeroContrat_key"
ON "contrats_collectifs_assurance"("idAssureur", "numeroContrat");
CREATE INDEX "contrats_collectifs_assurance_idEntreprise_statut_idx"
ON "contrats_collectifs_assurance"("idEntreprise", "statut");
CREATE INDEX "contrats_collectifs_assurance_idAssureur_statut_idx"
ON "contrats_collectifs_assurance"("idAssureur", "statut");

ALTER TABLE "contrats_collectifs_assurance"
ADD CONSTRAINT "contrats_collectifs_assurance_idEntreprise_fkey"
FOREIGN KEY ("idEntreprise") REFERENCES "entreprises_assurees"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contrats_collectifs_assurance"
ADD CONSTRAINT "contrats_collectifs_assurance_idAssureur_fkey"
FOREIGN KEY ("idAssureur") REFERENCES "assureurs"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "adhesions_assurance" (
    "id" TEXT NOT NULL,
    "numeroAdherent" TEXT NOT NULL,
    "jetonCarte" TEXT NOT NULL,
    "dateEffet" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3),
    "statut" "StatutContrat" NOT NULL DEFAULT 'ACTIF',
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifieLe" TIMESTAMP(3) NOT NULL,
    "motifFin" TEXT,
    "finEnregistreeLe" TIMESTAMP(3),
    "idFinEnregistreePar" TEXT,
    "idContratCollectif" TEXT NOT NULL,
    "idPatient" TEXT NOT NULL,
    CONSTRAINT "adhesions_assurance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "adhesions_assurance_jetonCarte_key"
ON "adhesions_assurance"("jetonCarte");
CREATE UNIQUE INDEX "adhesions_assurance_idContratCollectif_numeroAdherent_key"
ON "adhesions_assurance"("idContratCollectif", "numeroAdherent");
CREATE UNIQUE INDEX "adhesions_assurance_idContratCollectif_idPatient_key"
ON "adhesions_assurance"("idContratCollectif", "idPatient");
CREATE INDEX "adhesions_assurance_idPatient_statut_idx"
ON "adhesions_assurance"("idPatient", "statut");

ALTER TABLE "adhesions_assurance"
ADD CONSTRAINT "adhesions_assurance_idFinEnregistreePar_fkey"
FOREIGN KEY ("idFinEnregistreePar") REFERENCES "utilisateurs"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "adhesions_assurance"
ADD CONSTRAINT "adhesions_assurance_idContratCollectif_fkey"
FOREIGN KEY ("idContratCollectif") REFERENCES "contrats_collectifs_assurance"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "adhesions_assurance"
ADD CONSTRAINT "adhesions_assurance_idPatient_fkey"
FOREIGN KEY ("idPatient") REFERENCES "patients"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- Une regle propre a une police vise exactement un contrat : individuel ou
-- collectif. La contrainte CHECK n'est pas exprimable dans le schema Prisma.
CREATE TABLE "regles_couverture_police" (
    "id" TEXT NOT NULL,
    "categorie" "CategorieProduit" NOT NULL,
    "exclu" BOOLEAN NOT NULL DEFAULT false,
    "tauxPourcent" INTEGER,
    "plafondLigneGnf" INTEGER NOT NULL DEFAULT 0,
    "dateEffet" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idContratAssurance" TEXT,
    "idContratCollectif" TEXT,
    CONSTRAINT "regles_couverture_police_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "regles_couverture_police_un_seul_contrat_check"
      CHECK (("idContratAssurance" IS NOT NULL)::INTEGER + ("idContratCollectif" IS NOT NULL)::INTEGER = 1)
);

CREATE INDEX "regles_couverture_police_idContratAssurance_categorie_dateE_idx"
ON "regles_couverture_police"("idContratAssurance", "categorie", "dateEffet");
CREATE INDEX "regles_couverture_police_idContratCollectif_categorie_dateE_idx"
ON "regles_couverture_police"("idContratCollectif", "categorie", "dateEffet");

ALTER TABLE "regles_couverture_police"
ADD CONSTRAINT "regles_couverture_police_idContratAssurance_fkey"
FOREIGN KEY ("idContratAssurance") REFERENCES "contrats_assurance"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "regles_couverture_police"
ADD CONSTRAINT "regles_couverture_police_idContratCollectif_fkey"
FOREIGN KEY ("idContratCollectif") REFERENCES "contrats_collectifs_assurance"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ventes_comptoir"
ADD COLUMN "idAdhesionAssurance" TEXT;
CREATE INDEX "ventes_comptoir_idAdhesionAssurance_idx"
ON "ventes_comptoir"("idAdhesionAssurance");
ALTER TABLE "ventes_comptoir"
ADD CONSTRAINT "ventes_comptoir_idAdhesionAssurance_fkey"
FOREIGN KEY ("idAdhesionAssurance") REFERENCES "adhesions_assurance"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "controles_eligibilite"
ADD COLUMN "idAdhesionAssurance" TEXT;
CREATE INDEX "controles_eligibilite_idAdhesionAssurance_idx"
ON "controles_eligibilite"("idAdhesionAssurance");
ALTER TABLE "controles_eligibilite"
ADD CONSTRAINT "controles_eligibilite_idAdhesionAssurance_fkey"
FOREIGN KEY ("idAdhesionAssurance") REFERENCES "adhesions_assurance"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

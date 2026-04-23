-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PATIENT', 'ASC', 'ASC_SUPERVISOR', 'MEDECIN', 'PHARMACIEN', 'ADMIN_STRUCTURE', 'ADMIN_REGIONAL', 'ADMIN_NATIONAL', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "EncounterStatus" AS ENUM ('PLANIFIEE', 'EN_COURS', 'TERMINEE', 'ANNULEE', 'REFERENCEE');

-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('EN_ATTENTE', 'ACCEPTE', 'REFUSE', 'COMPLETE');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('EN_ATTENTE', 'PAYEE', 'PARTIELLE', 'ANNULEE', 'REMBOURSEE');

-- CreateEnum
CREATE TYPE "Urgence" AS ENUM ('ROUTINE', 'URGENT', 'URGENCE_VITALE');

-- CreateEnum
CREATE TYPE "TypeStructure" AS ENUM ('POSTE', 'CENTRE', 'HOPITAL_PREF', 'HOPITAL_REG', 'CHU', 'CLINIQUE');

-- CreateEnum
CREATE TYPE "StatutOrdonnance" AS ENUM ('EN_ATTENTE', 'DELIVREE', 'EXPIREE', 'ANNULEE');

-- CreateTable
CREATE TABLE "utilisateurs" (
    "id" TEXT NOT NULL,
    "telephone" TEXT NOT NULL,
    "email" TEXT,
    "motDePasseHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "prenom" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "langue" TEXT NOT NULL DEFAULT 'fr',
    "photoUrl" TEXT,
    "estActif" BOOLEAN NOT NULL DEFAULT true,
    "twoFaActive" BOOLEAN NOT NULL DEFAULT false,
    "twoFaSecret" TEXT,
    "derniereConnexion" TIMESTAMP(3),
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifieLe" TIMESTAMP(3) NOT NULL,
    "idStructure" TEXT,

    CONSTRAINT "utilisateurs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expireLe" TIMESTAMP(3) NOT NULL,
    "ipAdresse" TEXT,
    "userAgent" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idUtilisateur" TEXT NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_audit" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "ressource" TEXT NOT NULL,
    "idRessource" TEXT,
    "ipAdresse" TEXT,
    "userAgent" TEXT,
    "metadonnees" JSONB,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idUtilisateur" TEXT NOT NULL,

    CONSTRAINT "journal_audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "structures" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "type" "TypeStructure" NOT NULL,
    "prefecture" TEXT NOT NULL,
    "adresse" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "telephone" TEXT,
    "photoUrl" TEXT,
    "estActive" BOOLEAN NOT NULL DEFAULT true,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "structures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" TEXT NOT NULL,
    "qrCode" TEXT NOT NULL,
    "dateNaissance" TIMESTAMP(3) NOT NULL,
    "sexe" TEXT NOT NULL,
    "groupeSanguin" TEXT,
    "allergies" TEXT[],
    "maladiesChroniques" TEXT[],
    "prefecture" TEXT NOT NULL,
    "sousPrefecture" TEXT,
    "village" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "photoUrl" TEXT,
    "urgenceNom" TEXT,
    "urgenceTelephone" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifieLe" TIMESTAMP(3) NOT NULL,
    "idUtilisateur" TEXT NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profils_asc" (
    "id" TEXT NOT NULL,
    "zoneCouverture" JSONB,
    "numeroCertification" TEXT,
    "photoUrl" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idUtilisateur" TEXT NOT NULL,
    "idSuperviseur" TEXT,
    "idStructure" TEXT,

    CONSTRAINT "profils_asc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultations" (
    "id" TEXT NOT NULL,
    "statut" "EncounterStatus" NOT NULL DEFAULT 'EN_COURS',
    "motifPrincipal" TEXT NOT NULL,
    "symptomes" TEXT[],
    "protocoleUtilise" TEXT,
    "confianceIa" DOUBLE PRECISION,
    "resumeIa" TEXT,
    "notesAsc" TEXT,
    "notesMedecin" TEXT,
    "piecesJointes" TEXT[],
    "signeLe" TIMESTAMP(3),
    "consulteeLE" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifieLe" TIMESTAMP(3) NOT NULL,
    "idPatient" TEXT NOT NULL,
    "idAsc" TEXT,
    "idMedecinValideur" TEXT,

    CONSTRAINT "consultations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "constantes_vitales" (
    "id" TEXT NOT NULL,
    "temperature" DOUBLE PRECISION,
    "poidsKg" DOUBLE PRECISION,
    "tailleCm" DOUBLE PRECISION,
    "perimetreBrachial" DOUBLE PRECISION,
    "tensionSystolique" INTEGER,
    "tensionDiastolique" INTEGER,
    "frequenceCardiaque" INTEGER,
    "frequenceRespiratoire" INTEGER,
    "spo2" DOUBLE PRECISION,
    "glycemie" DOUBLE PRECISION,
    "alertes" TEXT[],
    "mesureLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idConsultation" TEXT NOT NULL,

    CONSTRAINT "constantes_vitales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnostics" (
    "id" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "codeIcd11" TEXT,
    "typeDiagnostic" TEXT NOT NULL DEFAULT 'PRINCIPAL',
    "severite" TEXT,
    "statutClinique" TEXT NOT NULL DEFAULT 'ACTIF',
    "source" TEXT NOT NULL,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idConsultation" TEXT NOT NULL,

    CONSTRAINT "diagnostics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medicaments" (
    "id" TEXT NOT NULL,
    "dci" TEXT NOT NULL,
    "nomCommercial" TEXT,
    "forme" TEXT NOT NULL,
    "dosage" TEXT NOT NULL,
    "categorie" TEXT,
    "imageUrl" TEXT,
    "listeEssentielle" BOOLEAN NOT NULL DEFAULT false,
    "estActif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "medicaments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ordonnances" (
    "id" TEXT NOT NULL,
    "posologie" TEXT NOT NULL,
    "frequence" TEXT NOT NULL,
    "dureeJours" INTEGER NOT NULL,
    "instructions" TEXT,
    "statut" "StatutOrdonnance" NOT NULL DEFAULT 'EN_ATTENTE',
    "urlDocument" TEXT,
    "signeLe" TIMESTAMP(3),
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idConsultation" TEXT NOT NULL,
    "idMedicament" TEXT NOT NULL,
    "signePar" TEXT,

    CONSTRAINT "ordonnances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vaccinations" (
    "id" TEXT NOT NULL,
    "vaccinNom" TEXT NOT NULL,
    "codeEpi" TEXT,
    "numeroLot" TEXT,
    "siteInjection" TEXT,
    "reaction" TEXT,
    "urlCertificat" TEXT,
    "dateProchaineD" TIMESTAMP(3),
    "administreLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idPatient" TEXT NOT NULL,
    "idAdministrePar" TEXT NOT NULL,

    CONSTRAINT "vaccinations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rendez_vous" (
    "id" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'PLANIFIE',
    "motif" TEXT,
    "prevuLe" TIMESTAMP(3) NOT NULL,
    "rappel24h" BOOLEAN NOT NULL DEFAULT false,
    "rappel2h" BOOLEAN NOT NULL DEFAULT false,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifieLe" TIMESTAMP(3) NOT NULL,
    "idPatient" TEXT NOT NULL,
    "idAsc" TEXT NOT NULL,
    "idConsultation" TEXT,

    CONSTRAINT "rendez_vous_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referencements" (
    "id" TEXT NOT NULL,
    "urgence" "Urgence" NOT NULL DEFAULT 'ROUTINE',
    "statut" "ReferralStatus" NOT NULL DEFAULT 'EN_ATTENTE',
    "resumeClinique" TEXT NOT NULL,
    "motifRefus" TEXT,
    "urlDocument" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reponduLe" TIMESTAMP(3),
    "idConsultation" TEXT NOT NULL,
    "idStructureSource" TEXT,
    "idStructureCible" TEXT NOT NULL,
    "idMedecinValideur" TEXT,

    CONSTRAINT "referencements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "contenu" TEXT NOT NULL,
    "lu" BOOLEAN NOT NULL DEFAULT false,
    "luLe" TIMESTAMP(3),
    "envoyeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idExpediteur" TEXT NOT NULL,
    "idDestinataire" TEXT NOT NULL,
    "idConsultation" TEXT,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stocks" (
    "id" TEXT NOT NULL,
    "quantite" INTEGER NOT NULL DEFAULT 0,
    "seuilAlerte" INTEGER NOT NULL DEFAULT 10,
    "unite" TEXT NOT NULL,
    "datePeremption" TIMESTAMP(3),
    "modifieLe" TIMESTAMP(3) NOT NULL,
    "idAsc" TEXT NOT NULL,
    "idMedicament" TEXT NOT NULL,

    CONSTRAINT "stocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "factures" (
    "id" TEXT NOT NULL,
    "montantGnf" INTEGER NOT NULL,
    "statut" "InvoiceStatus" NOT NULL DEFAULT 'EN_ATTENTE',
    "modePaiement" TEXT,
    "referenceOperateur" TEXT,
    "numeroOperateur" TEXT,
    "urlRecu" TEXT,
    "payeeLe" TIMESTAMP(3),
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifieLe" TIMESTAMP(3) NOT NULL,
    "idPatient" TEXT NOT NULL,
    "idConsultation" TEXT,

    CONSTRAINT "factures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "utilisateurs_telephone_key" ON "utilisateurs"("telephone");

-- CreateIndex
CREATE UNIQUE INDEX "utilisateurs_email_key" ON "utilisateurs"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refreshToken_key" ON "sessions"("refreshToken");

-- CreateIndex
CREATE UNIQUE INDEX "patients_qrCode_key" ON "patients"("qrCode");

-- CreateIndex
CREATE UNIQUE INDEX "patients_idUtilisateur_key" ON "patients"("idUtilisateur");

-- CreateIndex
CREATE UNIQUE INDEX "profils_asc_idUtilisateur_key" ON "profils_asc"("idUtilisateur");

-- CreateIndex
CREATE UNIQUE INDEX "constantes_vitales_idConsultation_key" ON "constantes_vitales"("idConsultation");

-- CreateIndex
CREATE UNIQUE INDEX "rendez_vous_idConsultation_key" ON "rendez_vous"("idConsultation");

-- CreateIndex
CREATE UNIQUE INDEX "referencements_idConsultation_key" ON "referencements"("idConsultation");

-- CreateIndex
CREATE UNIQUE INDEX "stocks_idAsc_idMedicament_key" ON "stocks"("idAsc", "idMedicament");

-- CreateIndex
CREATE UNIQUE INDEX "factures_referenceOperateur_key" ON "factures"("referenceOperateur");

-- CreateIndex
CREATE UNIQUE INDEX "factures_idConsultation_key" ON "factures"("idConsultation");

-- AddForeignKey
ALTER TABLE "utilisateurs" ADD CONSTRAINT "utilisateurs_idStructure_fkey" FOREIGN KEY ("idStructure") REFERENCES "structures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_idUtilisateur_fkey" FOREIGN KEY ("idUtilisateur") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_audit" ADD CONSTRAINT "journal_audit_idUtilisateur_fkey" FOREIGN KEY ("idUtilisateur") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_idUtilisateur_fkey" FOREIGN KEY ("idUtilisateur") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profils_asc" ADD CONSTRAINT "profils_asc_idUtilisateur_fkey" FOREIGN KEY ("idUtilisateur") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profils_asc" ADD CONSTRAINT "profils_asc_idSuperviseur_fkey" FOREIGN KEY ("idSuperviseur") REFERENCES "profils_asc"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profils_asc" ADD CONSTRAINT "profils_asc_idStructure_fkey" FOREIGN KEY ("idStructure") REFERENCES "structures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_idPatient_fkey" FOREIGN KEY ("idPatient") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_idAsc_fkey" FOREIGN KEY ("idAsc") REFERENCES "profils_asc"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_idMedecinValideur_fkey" FOREIGN KEY ("idMedecinValideur") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "constantes_vitales" ADD CONSTRAINT "constantes_vitales_idConsultation_fkey" FOREIGN KEY ("idConsultation") REFERENCES "consultations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostics" ADD CONSTRAINT "diagnostics_idConsultation_fkey" FOREIGN KEY ("idConsultation") REFERENCES "consultations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordonnances" ADD CONSTRAINT "ordonnances_idConsultation_fkey" FOREIGN KEY ("idConsultation") REFERENCES "consultations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordonnances" ADD CONSTRAINT "ordonnances_idMedicament_fkey" FOREIGN KEY ("idMedicament") REFERENCES "medicaments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordonnances" ADD CONSTRAINT "ordonnances_signePar_fkey" FOREIGN KEY ("signePar") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaccinations" ADD CONSTRAINT "vaccinations_idPatient_fkey" FOREIGN KEY ("idPatient") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaccinations" ADD CONSTRAINT "vaccinations_idAdministrePar_fkey" FOREIGN KEY ("idAdministrePar") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rendez_vous" ADD CONSTRAINT "rendez_vous_idPatient_fkey" FOREIGN KEY ("idPatient") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rendez_vous" ADD CONSTRAINT "rendez_vous_idAsc_fkey" FOREIGN KEY ("idAsc") REFERENCES "profils_asc"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rendez_vous" ADD CONSTRAINT "rendez_vous_idConsultation_fkey" FOREIGN KEY ("idConsultation") REFERENCES "consultations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referencements" ADD CONSTRAINT "referencements_idConsultation_fkey" FOREIGN KEY ("idConsultation") REFERENCES "consultations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referencements" ADD CONSTRAINT "referencements_idStructureSource_fkey" FOREIGN KEY ("idStructureSource") REFERENCES "structures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referencements" ADD CONSTRAINT "referencements_idStructureCible_fkey" FOREIGN KEY ("idStructureCible") REFERENCES "structures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referencements" ADD CONSTRAINT "referencements_idMedecinValideur_fkey" FOREIGN KEY ("idMedecinValideur") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_idExpediteur_fkey" FOREIGN KEY ("idExpediteur") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_idDestinataire_fkey" FOREIGN KEY ("idDestinataire") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_idConsultation_fkey" FOREIGN KEY ("idConsultation") REFERENCES "consultations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stocks" ADD CONSTRAINT "stocks_idAsc_fkey" FOREIGN KEY ("idAsc") REFERENCES "profils_asc"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stocks" ADD CONSTRAINT "stocks_idMedicament_fkey" FOREIGN KEY ("idMedicament") REFERENCES "medicaments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factures" ADD CONSTRAINT "factures_idPatient_fkey" FOREIGN KEY ("idPatient") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factures" ADD CONSTRAINT "factures_idConsultation_fkey" FOREIGN KEY ("idConsultation") REFERENCES "consultations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

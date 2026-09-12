-- Notifications in-app (cloche dans les layouts web) et parametres globaux
-- de la plateforme (page Parametres du super-admin).

-- CreateEnum
CREATE TYPE "TypeNotification" AS ENUM ('RAPPEL_RENDEZ_VOUS', 'REFERENCEMENT_ACCEPTE', 'REFERENCEMENT_REFUSE', 'ALERTE_STOCK', 'RAPPEL_VACCINATION', 'ORDONNANCE_SIGNEE', 'NOUVEAU_MESSAGE', 'ALERTE_VITALE');

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "type" "TypeNotification" NOT NULL,
    "titre" TEXT NOT NULL,
    "contenu" TEXT NOT NULL,
    "lienAction" TEXT,
    "metadonnees" JSONB,
    "luLe" TIMESTAMP(3),
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idUtilisateur" TEXT NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parametres_systeme" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "valeurs" JSONB NOT NULL,
    "modifieLe" TIMESTAMP(3) NOT NULL,
    "idModifiePar" TEXT,

    CONSTRAINT "parametres_systeme_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_idUtilisateur_luLe_idx" ON "notifications"("idUtilisateur", "luLe");

-- CreateIndex
CREATE INDEX "notifications_idUtilisateur_creeLe_idx" ON "notifications"("idUtilisateur", "creeLe" DESC);

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_idUtilisateur_fkey" FOREIGN KEY ("idUtilisateur") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

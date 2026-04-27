-- CreateTable
CREATE TABLE "profils_medecin" (
    "id" TEXT NOT NULL,
    "numeroCom" TEXT,
    "specialite" TEXT,
    "photoUrl" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idUtilisateur" TEXT NOT NULL,
    "idStructure" TEXT,

    CONSTRAINT "profils_medecin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "profils_medecin_idUtilisateur_key" ON "profils_medecin"("idUtilisateur");

-- AddForeignKey
ALTER TABLE "profils_medecin" ADD CONSTRAINT "profils_medecin_idUtilisateur_fkey" FOREIGN KEY ("idUtilisateur") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profils_medecin" ADD CONSTRAINT "profils_medecin_idStructure_fkey" FOREIGN KEY ("idStructure") REFERENCES "structures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "mot_de_passe_resets" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expireLe" TIMESTAMP(3) NOT NULL,
    "utiliseLe" TIMESTAMP(3),
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idUtilisateur" TEXT NOT NULL,

    CONSTRAINT "mot_de_passe_resets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mot_de_passe_resets_tokenHash_key" ON "mot_de_passe_resets"("tokenHash");

-- CreateIndex
CREATE INDEX "mot_de_passe_resets_idUtilisateur_idx" ON "mot_de_passe_resets"("idUtilisateur");

-- AddForeignKey
ALTER TABLE "mot_de_passe_resets" ADD CONSTRAINT "mot_de_passe_resets_idUtilisateur_fkey" FOREIGN KEY ("idUtilisateur") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

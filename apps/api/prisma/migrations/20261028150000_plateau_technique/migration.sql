
-- CreateTable
CREATE TABLE "plateaux_techniques" (
    "id" TEXT NOT NULL,
    "idStructure" TEXT NOT NULL,
    "idExamen" TEXT NOT NULL,
    "delaiHeures" INTEGER,
    "prixGnf" INTEGER,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "declareLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifieLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plateaux_techniques_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "structures_conseillees" (
    "id" TEXT NOT NULL,
    "idStructure" TEXT NOT NULL,
    "idStructureConseillee" TEXT NOT NULL,
    "declareLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "declarePar" TEXT NOT NULL,

    CONSTRAINT "structures_conseillees_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "plateaux_techniques_idStructure_actif_idx" ON "plateaux_techniques"("idStructure", "actif");

-- CreateIndex
CREATE INDEX "plateaux_techniques_idExamen_actif_idx" ON "plateaux_techniques"("idExamen", "actif");

-- CreateIndex
CREATE UNIQUE INDEX "plateaux_techniques_idStructure_idExamen_key" ON "plateaux_techniques"("idStructure", "idExamen");

-- CreateIndex
CREATE INDEX "structures_conseillees_idStructure_idx" ON "structures_conseillees"("idStructure");

-- CreateIndex
CREATE UNIQUE INDEX "structures_conseillees_idStructure_idStructureConseillee_key" ON "structures_conseillees"("idStructure", "idStructureConseillee");

-- AddForeignKey
ALTER TABLE "plateaux_techniques" ADD CONSTRAINT "plateaux_techniques_idStructure_fkey" FOREIGN KEY ("idStructure") REFERENCES "structures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plateaux_techniques" ADD CONSTRAINT "plateaux_techniques_idExamen_fkey" FOREIGN KEY ("idExamen") REFERENCES "examens"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "structures_conseillees" ADD CONSTRAINT "structures_conseillees_idStructure_fkey" FOREIGN KEY ("idStructure") REFERENCES "structures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "structures_conseillees" ADD CONSTRAINT "structures_conseillees_idStructureConseillee_fkey" FOREIGN KEY ("idStructureConseillee") REFERENCES "structures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "structures_conseillees" ADD CONSTRAINT "structures_conseillees_declarePar_fkey" FOREIGN KEY ("declarePar") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ════════════════════════════════════════════════════════════════════
-- Les invariants, et pourquoi ils sont la.
-- ════════════════════════════════════════════════════════════════════

-- Un delai de rendu annonce se compte en heures pleines et positives. NULL
-- reste permis : il signifie « celui du referentiel ».
--
-- **Le NULL est enveloppe exprès.** En SQL, un CHECK qui s'evalue a NULL
-- ACCEPTE la ligne : ecrire `"delaiHeures" > 0` seul laisserait passer un
-- NULL sans que rien ne le signale. Ce projet s'est deja fait avoir une fois.
ALTER TABLE "plateaux_techniques"
    ADD CONSTRAINT "plateaux_techniques_delai_positif"
    CHECK ("delaiHeures" IS NULL OR "delaiHeures" > 0);

-- Un prix n'est renseigne que s'il differe du referentiel national ; quand il
-- l'est, il est strictement positif. Meme garde du NULL.
ALTER TABLE "plateaux_techniques"
    ADD CONSTRAINT "plateaux_techniques_prix_positif"
    CHECK ("prixGnf" IS NULL OR "prixGnf" > 0);

-- **Un etablissement ne se conseille pas lui-meme.** Il figure deja en tete de
-- la liste de ses medecins, au titre du laboratoire « chez nous » : s'y
-- ajouter une seconde fois le ferait apparaitre deux fois, dans deux groupes
-- qui ne disent pas la meme chose.
ALTER TABLE "structures_conseillees"
    ADD CONSTRAINT "structures_conseillees_pas_soi_meme"
    CHECK ("idStructure" <> "idStructureConseillee");

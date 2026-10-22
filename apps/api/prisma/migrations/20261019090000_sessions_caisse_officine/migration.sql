CREATE TYPE "StatutSessionCaisse" AS ENUM ('OUVERTE', 'CLOTUREE');

CREATE TABLE "sessions_caisse" (
    "id" TEXT NOT NULL,
    "statut" "StatutSessionCaisse" NOT NULL DEFAULT 'OUVERTE',
    "montantOuvertureGnf" INTEGER NOT NULL,
    "montantEspecesEncaisseGnf" INTEGER,
    "montantOrangeMoneyGnf" INTEGER,
    "montantMtnMomoGnf" INTEGER,
    "montantTheoriqueGnf" INTEGER,
    "montantCompteGnf" INTEGER,
    "ecartGnf" INTEGER,
    "nombreVentesPayees" INTEGER,
    "nombreVentesEnAttente" INTEGER,
    "nombreVentesAnnulees" INTEGER,
    "motifEcart" TEXT,
    "ouverteLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clotureeLe" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "idStructure" TEXT NOT NULL,
    "idUtilisateur" TEXT NOT NULL,
    CONSTRAINT "sessions_caisse_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ventes_comptoir" ADD COLUMN "idSessionCaisse" TEXT;

ALTER TABLE "sessions_caisse"
    ADD CONSTRAINT "sessions_caisse_montants_non_negatifs" CHECK (
        "montantOuvertureGnf" >= 0
        AND ("montantEspecesEncaisseGnf" IS NULL OR "montantEspecesEncaisseGnf" >= 0)
        AND ("montantOrangeMoneyGnf" IS NULL OR "montantOrangeMoneyGnf" >= 0)
        AND ("montantMtnMomoGnf" IS NULL OR "montantMtnMomoGnf" >= 0)
        AND ("montantTheoriqueGnf" IS NULL OR "montantTheoriqueGnf" >= 0)
        AND ("montantCompteGnf" IS NULL OR "montantCompteGnf" >= 0)
        AND ("nombreVentesPayees" IS NULL OR "nombreVentesPayees" >= 0)
        AND ("nombreVentesEnAttente" IS NULL OR "nombreVentesEnAttente" >= 0)
        AND ("nombreVentesAnnulees" IS NULL OR "nombreVentesAnnulees" >= 0)
    ),
    ADD CONSTRAINT "sessions_caisse_cloture_coherente" CHECK (
        (
            "statut" = 'OUVERTE'
            AND "montantEspecesEncaisseGnf" IS NULL
            AND "montantOrangeMoneyGnf" IS NULL
            AND "montantMtnMomoGnf" IS NULL
            AND "montantTheoriqueGnf" IS NULL
            AND "montantCompteGnf" IS NULL
            AND "ecartGnf" IS NULL
            AND "nombreVentesPayees" IS NULL
            AND "nombreVentesEnAttente" IS NULL
            AND "nombreVentesAnnulees" IS NULL
            AND "clotureeLe" IS NULL
        )
        OR
        (
            "statut" = 'CLOTUREE'
            AND "montantEspecesEncaisseGnf" IS NOT NULL
            AND "montantOrangeMoneyGnf" IS NOT NULL
            AND "montantMtnMomoGnf" IS NOT NULL
            AND "montantTheoriqueGnf" IS NOT NULL
            AND "montantTheoriqueGnf" = "montantOuvertureGnf" + "montantEspecesEncaisseGnf"
            AND "montantCompteGnf" IS NOT NULL
            AND "ecartGnf" IS NOT NULL
            AND "ecartGnf" = "montantCompteGnf" - "montantTheoriqueGnf"
            AND "nombreVentesPayees" IS NOT NULL
            AND "nombreVentesEnAttente" IS NOT NULL
            AND "nombreVentesAnnulees" IS NOT NULL
            AND "clotureeLe" IS NOT NULL
            AND ("ecartGnf" = 0 OR coalesce(length(btrim("motifEcart")), 0) >= 5)
        )
    );

CREATE INDEX "sessions_caisse_idStructure_ouverteLe_idx"
    ON "sessions_caisse"("idStructure", "ouverteLe" DESC);
CREATE INDEX "sessions_caisse_idUtilisateur_ouverteLe_idx"
    ON "sessions_caisse"("idUtilisateur", "ouverteLe" DESC);
CREATE UNIQUE INDEX "sessions_caisse_une_ouverte_par_utilisateur_idx"
    ON "sessions_caisse"("idStructure", "idUtilisateur")
    WHERE "statut" = 'OUVERTE';
CREATE INDEX "ventes_comptoir_idSessionCaisse_idx"
    ON "ventes_comptoir"("idSessionCaisse");

ALTER TABLE "sessions_caisse"
    ADD CONSTRAINT "sessions_caisse_idStructure_fkey"
    FOREIGN KEY ("idStructure") REFERENCES "structures"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sessions_caisse"
    ADD CONSTRAINT "sessions_caisse_idUtilisateur_fkey"
    FOREIGN KEY ("idUtilisateur") REFERENCES "utilisateurs"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ventes_comptoir"
    ADD CONSTRAINT "ventes_comptoir_idSessionCaisse_fkey"
    FOREIGN KEY ("idSessionCaisse") REFERENCES "sessions_caisse"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

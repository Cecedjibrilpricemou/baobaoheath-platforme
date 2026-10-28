-- P8-a : profils livreur, courses et offres. SQL de depart genere par
-- `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`.

CREATE TYPE "StatutCourse" AS ENUM ('APPEL_OFFRES', 'ATTRIBUEE', 'EN_COURS', 'LIVREE', 'SANS_MOTARD', 'ANNULEE');

CREATE TABLE "profils_livreur" (
    "id" TEXT NOT NULL,
    "qrCode" TEXT NOT NULL,
    "quartier" TEXT NOT NULL,
    "prefecture" TEXT NOT NULL,
    "estActif" BOOLEAN NOT NULL DEFAULT true,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idUtilisateur" TEXT NOT NULL,
    CONSTRAINT "profils_livreur_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "courses" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "statut" "StatutCourse" NOT NULL DEFAULT 'APPEL_OFFRES',
    "quartier" TEXT NOT NULL,
    "prefecture" TEXT NOT NULL,
    "prixGnf" INTEGER,
    "delaiAnnonceMinutes" INTEGER,
    "creeeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attribueeLe" TIMESTAMP(3),
    "remiseLe" TIMESTAMP(3),
    "livreeLe" TIMESTAMP(3),
    "annuleeLe" TIMESTAMP(3),
    "motifAnnulation" TEXT,
    "idCommande" TEXT NOT NULL,
    "idLivreur" TEXT,
    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "offres_course" (
    "id" TEXT NOT NULL,
    "prixGnf" INTEGER NOT NULL,
    "delaiMinutes" INTEGER NOT NULL,
    "creeeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idCourse" TEXT NOT NULL,
    "idLivreur" TEXT NOT NULL,
    CONSTRAINT "offres_course_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "profils_livreur_qrCode_key" ON "profils_livreur"("qrCode");
CREATE UNIQUE INDEX "profils_livreur_idUtilisateur_key" ON "profils_livreur"("idUtilisateur");
CREATE INDEX "profils_livreur_prefecture_quartier_estActif_idx" ON "profils_livreur"("prefecture", "quartier", "estActif");
CREATE UNIQUE INDEX "courses_numero_key" ON "courses"("numero");
CREATE INDEX "courses_prefecture_quartier_statut_idx" ON "courses"("prefecture", "quartier", "statut");
CREATE INDEX "courses_idLivreur_statut_idx" ON "courses"("idLivreur", "statut");
CREATE INDEX "offres_course_idLivreur_idx" ON "offres_course"("idLivreur");
CREATE UNIQUE INDEX "offres_course_idCourse_idLivreur_key" ON "offres_course"("idCourse", "idLivreur");

ALTER TABLE "profils_livreur" ADD CONSTRAINT "profils_livreur_idUtilisateur_fkey"
    FOREIGN KEY ("idUtilisateur") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "courses" ADD CONSTRAINT "courses_idCommande_fkey"
    FOREIGN KEY ("idCommande") REFERENCES "commandes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "courses" ADD CONSTRAINT "courses_idLivreur_fkey"
    FOREIGN KEY ("idLivreur") REFERENCES "profils_livreur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "offres_course" ADD CONSTRAINT "offres_course_idCourse_fkey"
    FOREIGN KEY ("idCourse") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "offres_course" ADD CONSTRAINT "offres_course_idLivreur_fkey"
    FOREIGN KEY ("idLivreur") REFERENCES "profils_livreur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Une commande peut avoir un historique de courses terminees, mais une seule
-- course non terminale a la fois (y compris apres une relance).
CREATE UNIQUE INDEX "courses_une_vivante_par_commande_idx"
    ON "courses"("idCommande")
    WHERE "statut" NOT IN ('LIVREE', 'ANNULEE');

-- Une course attribuee ou en cours ne peut exister sans motard, prix et delai
-- acceptes. Les statuts initiaux et les issues sans attribution en sont exclus.
ALTER TABLE "courses" ADD CONSTRAINT "courses_attribution_complete"
    CHECK (
        "statut" IN ('APPEL_OFFRES', 'SANS_MOTARD', 'ANNULEE')
        OR (
            "idLivreur" IS NOT NULL
            AND "prixGnf" IS NOT NULL
            AND "delaiAnnonceMinutes" IS NOT NULL
        )
    );

-- Un prix de course non nul doit etre strictement positif ; NULL reste permis
-- tant qu'aucune offre n'a ete attribuee.
ALTER TABLE "courses" ADD CONSTRAINT "courses_prix_positif"
    CHECK ("prixGnf" IS NULL OR "prixGnf" > 0);

-- Un delai annonce non nul doit etre strictement positif ; NULL reste permis
-- avant l'attribution d'une offre.
ALTER TABLE "courses" ADD CONSTRAINT "courses_delai_positif"
    CHECK ("delaiAnnonceMinutes" IS NULL OR "delaiAnnonceMinutes" > 0);

-- Toute attribution est datee, y compris les courses ensuite terminees.
ALTER TABLE "courses" ADD CONSTRAINT "courses_attribution_datee"
    CHECK ("statut" NOT IN ('ATTRIBUEE', 'EN_COURS', 'LIVREE') OR "attribueeLe" IS NOT NULL);

-- La remise au motard doit etre datee des que les produits sont partis.
ALTER TABLE "courses" ADD CONSTRAINT "courses_remise_datee"
    CHECK ("statut" NOT IN ('EN_COURS', 'LIVREE') OR "remiseLe" IS NOT NULL);

-- La livraison terminale doit porter son horodatage de confirmation patient.
ALTER TABLE "courses" ADD CONSTRAINT "courses_livraison_datee"
    CHECK ("statut" <> 'LIVREE' OR "livreeLe" IS NOT NULL);

-- Une annulation doit conserver un motif non vide d'au moins cinq caracteres.
-- COALESCE rend le refus explicite pour NULL, que CHECK accepterait sinon.
ALTER TABLE "courses" ADD CONSTRAINT "courses_annulation_justifiee"
    CHECK (
        "statut" <> 'ANNULEE'
        OR COALESCE(length(btrim("motifAnnulation")), 0) >= 5
    );

-- Une offre ne peut annoncer ni un prix nul/negatif ni un delai nul/negatif.
ALTER TABLE "offres_course" ADD CONSTRAINT "offres_course_valeurs_positives"
    CHECK ("prixGnf" > 0 AND "delaiMinutes" > 0);

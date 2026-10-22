-- Bris de glace (EF-02-06).
--
-- Un patient arrive inconscient dans un service qui ne le suit pas. Le
-- soignant a besoin de ses allergies, tout de suite. Un controle d'acces sans
-- porte de secours ferait prescrire a l'aveugle, et la regle serait contournee
-- autrement -- par un compte prete -- sans laisser de trace.
--
-- Ce qui distingue cette porte d'un passe-partout tient ici : un motif exige,
-- un acces qui expire, et une declaration qu'on ne peut pas reecrire apres
-- coup.

-- CreateEnum
CREATE TYPE "MotifBrisDeGlace" AS ENUM ('URGENCE_VITALE', 'PATIENT_HORS_ETAT', 'CONTINUITE_DES_SOINS', 'VERIFICATION_AVANT_PRESCRIPTION', 'AUTRE');

-- CreateEnum
CREATE TYPE "StatutRevueBrisDeGlace" AS ENUM ('A_REVOIR', 'JUSTIFIE', 'INJUSTIFIE');

-- CreateTable
CREATE TABLE "bris_de_glace" (
    "id" TEXT NOT NULL,
    "motif" "MotifBrisDeGlace" NOT NULL,
    "explication" TEXT NOT NULL,
    "idPatient" TEXT NOT NULL,
    "idAuteur" TEXT NOT NULL,
    "idStructure" TEXT,
    "ouvertLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expireLe" TIMESTAMP(3) NOT NULL,
    "refermeLe" TIMESTAMP(3),
    "statutRevue" "StatutRevueBrisDeGlace" NOT NULL DEFAULT 'A_REVOIR',
    "avisRevue" TEXT,
    "idRevuPar" TEXT,
    "revuLe" TIMESTAMP(3),
    "notifieLe" TIMESTAMP(3),

    CONSTRAINT "bris_de_glace_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bris_de_glace_idPatient_ouvertLe_idx" ON "bris_de_glace"("idPatient", "ouvertLe");

-- CreateIndex
CREATE INDEX "bris_de_glace_idAuteur_ouvertLe_idx" ON "bris_de_glace"("idAuteur", "ouvertLe");

-- CreateIndex
CREATE INDEX "bris_de_glace_statutRevue_ouvertLe_idx" ON "bris_de_glace"("statutRevue", "ouvertLe");

-- CreateIndex
CREATE INDEX "bris_de_glace_expireLe_idx" ON "bris_de_glace"("expireLe");

-- AddForeignKey
ALTER TABLE "bris_de_glace" ADD CONSTRAINT "bris_de_glace_idPatient_fkey" FOREIGN KEY ("idPatient") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bris_de_glace" ADD CONSTRAINT "bris_de_glace_idAuteur_fkey" FOREIGN KEY ("idAuteur") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bris_de_glace" ADD CONSTRAINT "bris_de_glace_idStructure_fkey" FOREIGN KEY ("idStructure") REFERENCES "structures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bris_de_glace" ADD CONSTRAINT "bris_de_glace_idRevuPar_fkey" FOREIGN KEY ("idRevuPar") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────
-- Ce qu'une declaration doit porter
-- ─────────────────────────────────────────────────────────────────────

-- Une explication qui ne dit rien ne permet ni de juger ni de contester.
-- Vingt caracteres : « patient inconscient » en fait dix-neuf, et c'est deja
-- plus parlant que « urgence ».
ALTER TABLE "bris_de_glace"
  ADD CONSTRAINT "bris_de_glace_explication_dit_quelque_chose"
  CHECK (length(btrim("explication")) >= 20);

-- **Un acces qui n'expire pas est une cle, pas une vitre brisee.** Et il
-- n'expire pas avant d'avoir ete ouvert.
ALTER TABLE "bris_de_glace"
  ADD CONSTRAINT "bris_de_glace_expire_apres_ouverture"
  CHECK ("expireLe" > "ouvertLe");

-- On ne referme pas avant d'avoir ouvert.
ALTER TABLE "bris_de_glace"
  ADD CONSTRAINT "bris_de_glace_refermeture_coherente"
  CHECK ("refermeLe" IS NULL OR "refermeLe" >= "ouvertLe");

-- Une revue rendue porte sa date et son avis. `idRevuPar` reste dehors : sa
-- cle etrangere est `ON DELETE SET NULL`, et l'exiger rendrait indeletable
-- tout administrateur ayant relu un dossier. Les deux se contrediraient --
-- l'erreur commise le 2026-10-04 sur l'identito-vigilance.
ALTER TABLE "bris_de_glace"
  ADD CONSTRAINT "bris_de_glace_revue_motivee"
  CHECK (
    ("statutRevue" = 'A_REVOIR')
    = ("revuLe" IS NULL AND "avisRevue" IS NULL)
  );

-- ─────────────────────────────────────────────────────────────────────
-- La declaration ne se reecrit pas
-- ─────────────────────────────────────────────────────────────────────
--
-- **Quelqu'un qui pourrait changer son motif apres coup n'aurait rien
-- declare.** La revue, elle, s'ecrit apres : le declencheur laisse passer les
-- colonnes qui lui appartiennent, et refuse les autres.
--
-- `refermeLe` est modifiable une seule fois, de NULL vers une date : refermer
-- l'acces est un geste honnete, le rouvrir en effacant la date ne l'est pas.

CREATE OR REPLACE FUNCTION bris_de_glace_declaration_figee() RETURNS TRIGGER AS $$
BEGIN
  IF NEW."motif" IS DISTINCT FROM OLD."motif"
     OR NEW."explication" IS DISTINCT FROM OLD."explication"
     OR NEW."idPatient" IS DISTINCT FROM OLD."idPatient"
     OR NEW."idAuteur" IS DISTINCT FROM OLD."idAuteur"
     OR NEW."idStructure" IS DISTINCT FROM OLD."idStructure"
     OR NEW."ouvertLe" IS DISTINCT FROM OLD."ouvertLe"
     OR NEW."expireLe" IS DISTINCT FROM OLD."expireLe"
  THEN
    RAISE EXCEPTION
      'EF-02-06 : la declaration d''un bris de glace ne se modifie pas. Seules la refermeture et la revue s''ecrivent apres coup.';
  END IF;

  IF OLD."refermeLe" IS NOT NULL AND NEW."refermeLe" IS DISTINCT FROM OLD."refermeLe" THEN
    RAISE EXCEPTION
      'EF-02-06 : un acces referme ne se rouvre pas. Declarez un nouveau bris de glace.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_bris_de_glace_declaration_figee
  BEFORE UPDATE ON "bris_de_glace"
  FOR EACH ROW EXECUTE FUNCTION bris_de_glace_declaration_figee();

-- Un bris de glace ne s'efface pas non plus : c'est la trace de l'acces, et
-- c'est tout ce qui separe ce mecanisme d'une porte derobee.
CREATE OR REPLACE FUNCTION bris_de_glace_pas_d_effacement() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION
    'EF-02-06 : un bris de glace ne s''efface pas. % est refuse sur bris_de_glace.', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_bris_de_glace_pas_d_effacement
  BEFORE DELETE ON "bris_de_glace"
  FOR EACH ROW EXECUTE FUNCTION bris_de_glace_pas_d_effacement();

-- `FOR EACH ROW` ne se declenche pas sur TRUNCATE. Oubli constate sur le
-- journal d'audit le 2026-10-03, ou `TRUNCATE journal_audit` passait malgre la
-- protection ligne a ligne.
CREATE TRIGGER trg_bris_de_glace_pas_de_troncature
  BEFORE TRUNCATE ON "bris_de_glace"
  FOR EACH STATEMENT EXECUTE FUNCTION bris_de_glace_pas_d_effacement();

-- Retrouver vite les acces encore ouverts : c'est la lecture que fait le
-- controle d'acces a chaque demande.
CREATE INDEX "bris_de_glace_ouverts_idx"
  ON "bris_de_glace" ("idAuteur", "idPatient", "expireLe")
  WHERE "refermeLe" IS NULL;

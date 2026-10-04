-- Consentement versionne (EF-02-01/03/07).
--
-- Un consentement ne vaut que pour ce qui a ete explique. Sans garder le texte
-- exact qui etait a l'ecran, on ne peut ni prouver ce que la personne a
-- accepte, ni le lui remontrer.
--
-- Et « versionne » veut dire qu'on garde l'histoire, pas seulement l'etat : un
-- retrait ecrasait l'accord, on ne savait plus que la personne avait accepte la
-- veille.

-- CreateEnum
CREATE TYPE "SensConsentement" AS ENUM ('ACCORDE', 'RETIRE');

-- AlterTable
ALTER TABLE "consentements_patient" ADD COLUMN     "idTexte" TEXT;

-- CreateTable
CREATE TABLE "textes_consentement" (
    "id" TEXT NOT NULL,
    "scope" "ConsentScope" NOT NULL,
    "langue" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "titre" TEXT NOT NULL,
    "corps" TEXT NOT NULL,
    "publieLe" TIMESTAMP(3),
    "idPubliePar" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "textes_consentement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evenements_consentement" (
    "id" TEXT NOT NULL,
    "idPatient" TEXT NOT NULL,
    "scope" "ConsentScope" NOT NULL,
    "sens" "SensConsentement" NOT NULL,
    "idTexte" TEXT,
    "source" TEXT NOT NULL,
    "commentaire" TEXT,
    "idAuteur" TEXT NOT NULL,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evenements_consentement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "textes_consentement_scope_langue_publieLe_idx" ON "textes_consentement"("scope", "langue", "publieLe");

-- CreateIndex
CREATE UNIQUE INDEX "textes_consentement_scope_langue_version_key" ON "textes_consentement"("scope", "langue", "version");

-- CreateIndex
CREATE INDEX "evenements_consentement_idPatient_creeLe_idx" ON "evenements_consentement"("idPatient", "creeLe");

-- CreateIndex
CREATE INDEX "evenements_consentement_idPatient_scope_creeLe_idx" ON "evenements_consentement"("idPatient", "scope", "creeLe");

-- AddForeignKey
ALTER TABLE "textes_consentement" ADD CONSTRAINT "textes_consentement_idPubliePar_fkey" FOREIGN KEY ("idPubliePar") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evenements_consentement" ADD CONSTRAINT "evenements_consentement_idPatient_fkey" FOREIGN KEY ("idPatient") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evenements_consentement" ADD CONSTRAINT "evenements_consentement_idTexte_fkey" FOREIGN KEY ("idTexte") REFERENCES "textes_consentement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evenements_consentement" ADD CONSTRAINT "evenements_consentement_idAuteur_fkey" FOREIGN KEY ("idAuteur") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consentements_patient" ADD CONSTRAINT "consentements_patient_idTexte_fkey" FOREIGN KEY ("idTexte") REFERENCES "textes_consentement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────
-- Le texte presente
-- ─────────────────────────────────────────────────────────────────────

-- Les versions commencent a 1 et montent.
ALTER TABLE "textes_consentement"
  ADD CONSTRAINT "textes_consentement_version_positive"
  CHECK ("version" >= 1);

-- Un texte de consentement qui ne dit rien n'explique rien. Quarante
-- caracteres, c'est deja peu pour dire a quoi on s'engage.
ALTER TABLE "textes_consentement"
  ADD CONSTRAINT "textes_consentement_corps_dit_quelque_chose"
  CHECK (length(btrim("corps")) >= 40 AND length(btrim("titre")) >= 3);

-- Une langue est un code court, en minuscules : fr, en, pu, ml.
ALTER TABLE "textes_consentement"
  ADD CONSTRAINT "textes_consentement_langue_normalisee"
  CHECK ("langue" ~ '^[a-z]{2}$');

-- Un texte publie porte sa date. L'auteur est volontairement hors de la
-- contrainte : sa cle etrangere est `ON DELETE SET NULL`, et l'exiger ici
-- rendrait indeletable tout administrateur ayant publie un texte. Les deux se
-- contrediraient — l'erreur commise le 2026-10-04 sur l'identito-vigilance.
ALTER TABLE "textes_consentement"
  ADD CONSTRAINT "textes_consentement_publication_datee"
  CHECK ("publieLe" IS NOT NULL OR "idPubliePar" IS NULL);

-- ─────────────────────────────────────────────────────────────────────
-- L'historique est en ajout seul
-- ─────────────────────────────────────────────────────────────────────
--
-- Meme raison que pour le journal d'audit (EF-12-04) : une table qui se laisse
-- reecrire ne prouve rien le jour ou il faut s'en servir. Un consentement
-- retire puis efface de l'historique ne laisserait aucune trace du retrait.

CREATE OR REPLACE FUNCTION empeche_mutation_consentement() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION
    'EF-02-07 : l''historique des consentements est en ajout seul. % est refuse sur evenements_consentement.',
    TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_evenements_consentement_ajout_seul
  BEFORE UPDATE OR DELETE ON "evenements_consentement"
  FOR EACH ROW EXECUTE FUNCTION empeche_mutation_consentement();

-- `FOR EACH ROW` ne se declenche pas sur TRUNCATE : il faut un second
-- declencheur. Oubli constate sur le journal d'audit le 2026-10-03, ou
-- `TRUNCATE journal_audit` passait malgre la protection ligne a ligne.
CREATE TRIGGER trg_evenements_consentement_pas_de_troncature
  BEFORE TRUNCATE ON "evenements_consentement"
  FOR EACH STATEMENT EXECUTE FUNCTION empeche_mutation_consentement();

-- ─────────────────────────────────────────────────────────────────────
-- Reprise de l'existant
-- ─────────────────────────────────────────────────────────────────────
--
-- Les consentements deja en base n'ont pas de texte : ils sont anterieurs au
-- versionnage, ou poses d'office par le systeme a la creation du dossier. On
-- ne leur en invente pas un — `idTexte` reste NULL, et c'est ce NULL qui dit
-- a l'ecran du patient que l'accord est **presume, jamais recueilli**.
--
-- On leur ecrit en revanche leur premier evenement, pour que l'historique ne
-- commence pas par un trou. Le sens et la date sont ceux de la ligne existante.
INSERT INTO "evenements_consentement"
  ("id", "idPatient", "scope", "sens", "idTexte", "source", "commentaire", "idAuteur", "creeLe")
SELECT
  gen_random_uuid()::text,
  c."idPatient",
  c."scope",
  CASE WHEN c."actif" THEN 'ACCORDE'::"SensConsentement" ELSE 'RETIRE'::"SensConsentement" END,
  NULL,
  c."source",
  'Etat repris lors de la mise en place du versionnage (EF-02-01). Aucun texte n''avait ete conserve.',
  c."idUtilisateur",
  COALESCE(c."retireLe", c."donneLe")
FROM "consentements_patient" c;

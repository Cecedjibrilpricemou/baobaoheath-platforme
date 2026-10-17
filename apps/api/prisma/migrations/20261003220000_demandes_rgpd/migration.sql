-- Les demandes d'exercice de droits (EF-12-09).
--
-- POURQUOI UNE TABLE, ET PAS UN SIMPLE BOUTON. Une demande RGPD a un delai,
-- un auteur, une decision et une motivation. Sans trace, on ne peut ni prouver
-- qu'on a repondu, ni expliquer un refus, ni savoir ce qui a ete fait.
--
-- Le projet a deja paye l'absence de cette table : 15 comptes de la base de
-- demonstration ont vu leur telephone remplace par « purged-<id> » le
-- 2026-08-04, sans aucune trace — ni au journal d'audit, ni dans le code du
-- depot. Et la purge etait a moitie faite : nom et prenom sont restes
-- lisibles, et un profil patient complet avec. Trouve le 2026-10-03 en
-- construisant l'ecran des comptes, qui affichait « Mamadou Sow » a cote d'un
-- telephone « purged- ».
--
-- Prisma proposait tout sauf la section 4.

-- ─── 1. Les enumeres ────────────────────────────────────────────────
CREATE TYPE "TypeDemandeRgpd" AS ENUM ('ACCES', 'RECTIFICATION', 'EFFACEMENT', 'PORTABILITE', 'OPPOSITION', 'LIMITATION');
CREATE TYPE "StatutDemandeRgpd" AS ENUM ('RECUE', 'EN_COURS', 'SATISFAITE', 'REFUSEE');

-- ─── 2. La table ────────────────────────────────────────────────────
CREATE TABLE "demandes_rgpd" (
    "id" TEXT NOT NULL,
    "type" "TypeDemandeRgpd" NOT NULL,
    "statut" "StatutDemandeRgpd" NOT NULL DEFAULT 'RECUE',
    "precision" TEXT,
    "dateLimite" TIMESTAMP(3) NOT NULL,
    "reponse" TEXT,
    "traiteLe" TIMESTAMP(3),
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifieLe" TIMESTAMP(3) NOT NULL,
    "idPatient" TEXT NOT NULL,
    "idTraitePar" TEXT,

    CONSTRAINT "demandes_rgpd_pkey" PRIMARY KEY ("id")
);

-- ─── 3. Les index et les cles ───────────────────────────────────────
-- La file de l'administration : les plus urgentes d'abord.
CREATE INDEX "demandes_rgpd_statut_dateLimite_idx" ON "demandes_rgpd"("statut", "dateLimite");
CREATE INDEX "demandes_rgpd_idPatient_creeLe_idx" ON "demandes_rgpd"("idPatient", "creeLe");

-- RESTRICT sur le patient : une demande d'effacement ne doit pas pouvoir
-- faire disparaitre la preuve qu'elle a ete faite et traitee.
ALTER TABLE "demandes_rgpd" ADD CONSTRAINT "demandes_rgpd_idPatient_fkey"
  FOREIGN KEY ("idPatient") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- SET NULL sur l'agent : son depart n'efface pas la decision qu'il a prise.
ALTER TABLE "demandes_rgpd" ADD CONSTRAINT "demandes_rgpd_idTraitePar_fkey"
  FOREIGN KEY ("idTraitePar") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── 4. Une demande close porte toujours sa reponse ─────────────────
-- Un refus sans motivation n'est pas contestable, et une demande satisfaite
-- sans trace de ce qui a ete fait ne prouve rien. La regle vit dans le SGBD
-- plutot que dans un seul service : c'est la meme discipline que la
-- suspension de compte (EF-12-01).
--
-- `traiteLe` accompagne la reponse : une demande close sans date ne permet
-- pas de verifier qu'on a tenu le delai.
ALTER TABLE "demandes_rgpd" ADD CONSTRAINT "demandes_rgpd_cloture_motivee"
  CHECK (
    "statut" IN ('RECUE', 'EN_COURS')
    OR ("reponse" IS NOT NULL AND length(btrim("reponse")) >= 10 AND "traiteLe" IS NOT NULL)
  );

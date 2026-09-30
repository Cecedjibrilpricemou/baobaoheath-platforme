-- Le role BIOLOGISTE disparait ; le laborantin valide (addendum du
-- 2026-09-28, point 4). La validation nominative reste bloquante : quelqu'un
-- continue de signer.
--
-- ECRITE A LA MAIN A DESSEIN. `prisma migrate diff` proposait deux choses
-- destructrices :
--   1. la conversion d'enumeration sans migrer les comptes au prealable, ce
--      qui echoue sur « invalid input value for enum Role_new: BIOLOGISTE » ;
--   2. DROP COLUMN "commentaireBiologiste" puis ADD COLUMN, ce qui aurait
--      efface les conclusions de laboratoire deja ecrites.

-- ── 1. Les biologistes deviennent laborantins ───────────────────────
-- Avant de retirer la valeur de l'enumeration, sans quoi la conversion
-- suivante echoue. Leurs comptes restent actifs et gardent leur identite :
-- les comptes rendus qu'ils ont valides continuent de porter leur nom.
UPDATE "utilisateurs" SET "role" = 'TECHNICIEN_LABO' WHERE "role" = 'BIOLOGISTE';

-- ── 2. Le role sort de l'enumeration ────────────────────────────────
-- PostgreSQL ne sait pas retirer une valeur d'un type enumere : il faut le
-- recreer. Une seule colonne l'utilise (`utilisateurs.role`), sans defaut.
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('PATIENT', 'ASC', 'ASC_SUPERVISOR', 'MEDECIN', 'PHARMACIEN', 'AGENT_ACCUEIL', 'TECHNICIEN_LABO', 'LIVREUR', 'ADMIN_STRUCTURE', 'ADMIN_REGIONAL', 'ADMIN_NATIONAL', 'SUPER_ADMIN');
ALTER TABLE "utilisateurs" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "public"."Role_old";
COMMIT;

-- ── 3. Le champ change de nom, sans perdre son contenu ──────────────
-- RENAME, pas DROP puis ADD : les conclusions deja ecrites restent.
ALTER TABLE "demandes_analyse" RENAME COLUMN "commentaireBiologiste" TO "commentaireLaboratoire";

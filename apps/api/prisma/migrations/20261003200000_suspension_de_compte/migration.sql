-- Suspension de compte : qui, quand, pourquoi (EF-12-01).
--
-- `estActif = false` disait qu'un compte etait ferme, mais pas **qui** l'avait
-- ferme, **quand**, ni **pourquoi**. Une suspension est une mesure grave — elle
-- coupe un soignant de ses patients — et doit pouvoir etre expliquee et
-- contestee.
--
-- Prisma proposait les deux premieres sections, et rien de destructif. Ce
-- fichier ajoute la contrainte qui empeche les trois colonnes de se
-- contredire.

-- ─── 1. Les colonnes ────────────────────────────────────────────────
ALTER TABLE "utilisateurs" ADD COLUMN "suspenduLe" TIMESTAMP(3),
                           ADD COLUMN "motifSuspension" TEXT,
                           ADD COLUMN "idSuspenduPar" TEXT;

-- ─── 2. L'auteur de la decision ─────────────────────────────────────
-- SET NULL : le depart de l'auteur ne doit ni effacer la trace de sa decision
-- ni empecher la suppression de son compte. Le journal d'audit, lui, garde le
-- detail — il est en ajout seul (EF-12-04).
ALTER TABLE "utilisateurs" ADD CONSTRAINT "utilisateurs_idSuspenduPar_fkey"
  FOREIGN KEY ("idSuspenduPar") REFERENCES "utilisateurs"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── 3. L'invariant, structurel plutot que conventionnel ────────────
-- Une suspension datee doit porter son motif, et le compte doit etre ferme.
-- Sans cette contrainte, un code futur pourrait poser `suspenduLe` en laissant
-- le compte ouvert — ou suspendre sans motif, ce qui rend la mesure
-- incontestable faute d'etre expliquee.
--
-- La contrainte tolere `estActif = false` SANS suspension datee : 15 comptes
-- de la base de demonstration ont ete fermes par l'ancienne voie
-- (`desactiverAgent`, reservee a l'admin de structure), et on ne va pas leur
-- inventer un motif ni un auteur qu'on ignore. Ces lignes restent donc telles
-- quelles, et le nouveau chemin, lui, renseigne toujours les trois colonnes.
ALTER TABLE "utilisateurs" ADD CONSTRAINT "utilisateurs_suspension_coherente"
  CHECK (
    "suspenduLe" IS NULL
    OR ("motifSuspension" IS NOT NULL AND "estActif" = false)
  );

-- Le statut du rendez-vous devient une enumeration, et l'arrivee du patient
-- se pointe (addendum du 2026-09-28, points 2 et 3).
--
-- ECRITE A LA MAIN A DESSEIN. `prisma migrate diff` proposait :
--     ALTER TABLE "rendez_vous" DROP COLUMN "statut",
--     ADD COLUMN "statut" "StatutRendezVous" NOT NULL DEFAULT 'PLANIFIE';
-- ce qui aurait efface les statuts existants — les rendez-vous annules
-- seraient tous repasses a « planifie ». La conversion ci-dessous se fait en
-- place, avec USING.

CREATE TYPE "StatutRendezVous" AS ENUM ('PLANIFIE', 'PRESENT', 'EN_CONSULTATION', 'TERMINE', 'ABSENT', 'ANNULE');

-- Pointage de l'arrivee par l'assistante.
ALTER TABLE "rendez_vous" ADD COLUMN "arriveeLe" TIMESTAMP(3);
ALTER TABLE "rendez_vous" ADD COLUMN "idPointePar" TEXT;

-- Conversion sans perte. Les deux valeurs en usage ('PLANIFIE', 'ANNULE')
-- appartiennent a l'enumeration. 'HONORE' n'a jamais ete ecrit par le code —
-- `asc.service.ts` le lisait sans que rien ne le pose — mais une base plus
-- ancienne pourrait en contenir : il devient 'TERMINE'.
--
-- Toute autre valeur fait echouer la migration, et c'est voulu : dans une
-- plateforme de sante, un statut inconnu silencieusement ramene a « planifie »
-- ferait reapparaitre des rendez-vous annules.
ALTER TABLE "rendez_vous"
  ALTER COLUMN "statut" DROP DEFAULT,
  ALTER COLUMN "statut" TYPE "StatutRendezVous"
    USING (CASE "statut" WHEN 'HONORE' THEN 'TERMINE' ELSE "statut" END)::"StatutRendezVous",
  ALTER COLUMN "statut" SET DEFAULT 'PLANIFIE';

ALTER TABLE "rendez_vous" ADD CONSTRAINT "rendez_vous_idPointePar_fkey"
  FOREIGN KEY ("idPointePar") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Identito-vigilance : traits distinctifs et niveau d'identite (EF-01-04/10).
--
-- POURQUOI CES DEUX TRAITS. Dans la region, les homonymes sont la regle
-- plutot que l'exception : « Mamadou Diallo, ne en 1990 » peut designer
-- plusieurs personnes dans la meme prefecture. Le lieu de naissance et le nom
-- de la mere sont les deux traits qui tranchent, et ce sont ceux qu'emploient
-- les registres d'etat civil.
--
-- CE QUE LE NIVEAU D'IDENTITE NE FAIT PAS : trier qui a droit aux soins. Un
-- patient a l'identite provisoire se fait consulter, suivre et prescrire
-- normalement. Le niveau ne verrouille que ce qui engage un tiers — la
-- facturation a un assureur et la delivrance de produits reglementes — parce
-- que la, une erreur d'identite coute a quelqu'un d'autre.
--
-- Prisma proposait les sections 1 a 3, et rien de destructif. Les colonnes
-- sont toutes nullables et le niveau vaut PROVISOIRE par defaut : les 10
-- patients deja en base passent donc sans rien casser, et sans qu'on leur
-- invente une verification qui n'a pas eu lieu.

-- ─── 1. Les enumeres ────────────────────────────────────────────────
CREATE TYPE "NiveauIdentite" AS ENUM ('PROVISOIRE', 'VERIFIEE');
CREATE TYPE "TypePieceIdentite" AS ENUM ('CARTE_NATIONALE', 'PASSEPORT', 'ACTE_NAISSANCE', 'CARTE_CONSULAIRE', 'PERMIS_CONDUIRE', 'AUTRE');

-- ─── 2. Les colonnes ────────────────────────────────────────────────
ALTER TABLE "patients" ADD COLUMN "lieuNaissance" TEXT,
                       ADD COLUMN "nomMere" TEXT,
                       ADD COLUMN "niveauIdentite" "NiveauIdentite" NOT NULL DEFAULT 'PROVISOIRE',
                       ADD COLUMN "typePiece" "TypePieceIdentite",
                       ADD COLUMN "numeroPiece" TEXT,
                       ADD COLUMN "identiteVerifieeLe" TIMESTAMP(3),
                       ADD COLUMN "idVerifiePar" TEXT;

-- ─── 3. L'auteur de la verification ─────────────────────────────────
-- SET NULL : le depart de l'agent n'efface pas le fait que l'identite a ete
-- verifiee, ni la piece sur laquelle il s'est fonde.
ALTER TABLE "patients" ADD CONSTRAINT "patients_idVerifiePar_fkey"
  FOREIGN KEY ("idVerifiePar") REFERENCES "utilisateurs"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── 4. Une identite verifiee dit sur quoi elle se fonde ────────────
-- Declarer une identite verifiee, c'est engager sa responsabilite en
-- affirmant avoir vu une piece. Sans la piece, sans son numero, sans l'auteur
-- et sans la date, l'affirmation n'est ni verifiable ni contestable — et
-- c'est elle qui ouvrira le tiers payant.
--
-- `lieuNaissance` est exige : il figure sur la carte nationale, sur le
-- passeport et sur l'acte de naissance, donc l'agent qui tient la piece l'a
-- sous les yeux.
--
-- `nomMere` ne l'est **pas** : il figure sur un acte de naissance mais pas
-- sur un passeport. L'exiger ferait echouer une verification parfaitement
-- valide. Il reste le trait le plus utile a la detection de doublons, et
-- l'ecran le reclamera sans le rendre bloquant.
--
-- `idVerifiePar` n'est **pas** exige non plus, et c'est une correction : une
-- premiere version de cette contrainte le reclamait, ce qui la mettait en
-- contradiction directe avec le `ON DELETE SET NULL` ci-dessus. Au depart de
-- l'agent, PostgreSQL pose `idVerifiePar = NULL` et la contrainte refusait
-- alors la ligne : **on ne pouvait plus supprimer un agent ayant verifie une
-- identite**. Trouve en eprouvant la migration sur une base jetable, pas en
-- relisant le SQL.
--
-- Ce que la contrainte exige est donc ce qui ne peut pas disparaitre : la
-- piece, son numero, la date et le lieu de naissance. L'auteur est enregistre
-- au moment de l'acte, et le journal d'audit en garde la trace — lui est en
-- ajout seul (EF-12-04). Qu'il devienne nul des annees plus tard est la
-- consequence d'un depart, pas une raison d'invalider la verification.
ALTER TABLE "patients" ADD CONSTRAINT "patients_identite_verifiee_fondee"
  CHECK (
    "niveauIdentite" = 'PROVISOIRE'
    OR (
      "typePiece" IS NOT NULL
      AND "numeroPiece" IS NOT NULL AND length(btrim("numeroPiece")) >= 3
      AND "identiteVerifieeLe" IS NOT NULL
      AND "lieuNaissance" IS NOT NULL AND length(btrim("lieuNaissance")) >= 2
    )
  );

-- ─── 5. Retrouver les homonymes ─────────────────────────────────────
-- La detection de doublons (EF-01-05) cherchera sur ces traits. L'index les
-- sert, et il sert aussi la recherche d'un patient a l'accueil, qui pose
-- exactement les memes questions : « vous etes ne ou ? », « le nom de votre
-- mere ? ».
CREATE INDEX "patients_traits_distinctifs_idx" ON "patients"("dateNaissance", "lieuNaissance");
CREATE INDEX "patients_niveau_identite_idx" ON "patients"("niveauIdentite");

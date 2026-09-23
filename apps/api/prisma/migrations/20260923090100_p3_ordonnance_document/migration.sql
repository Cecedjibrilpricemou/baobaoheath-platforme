-- P3 / EF-05-07, EF-05-08, EF-07-01 : l'ordonnance devient un document.
--
-- Avant : une ligne de la table "ordonnances" = un medicament prescrit. Il n'y
-- avait donc rien a numeroter ni a verifier : trois medicaments prescrits le
-- meme jour formaient trois "ordonnances" sans lien entre elles.
--
-- Apres : "ordonnances" porte le document (numero unique, code de
-- verification, fin de validite, signature du prescripteur) et
-- "lignes_ordonnance" porte les medicaments.
--
-- Les donnees existantes sont conservees : l'ancienne table est renommee en
-- lignes_ordonnance (les identifiants des lignes sont donc stables), et un
-- document est reconstitue par consultation ayant au moins une ligne.

-- ── 1. Liberer les noms de contraintes et d'index de l'ancienne table ──
ALTER TABLE "ordonnances" DROP CONSTRAINT IF EXISTS "ordonnances_idConsultation_fkey";
ALTER TABLE "ordonnances" DROP CONSTRAINT IF EXISTS "ordonnances_signePar_fkey";
ALTER TABLE "ordonnances" DROP CONSTRAINT IF EXISTS "ordonnances_idMedicament_fkey";
ALTER TABLE "ordonnances" RENAME CONSTRAINT "ordonnances_pkey" TO "lignes_ordonnance_pkey";
ALTER INDEX IF EXISTS "ordonnances_idConsultation_idx" RENAME TO "lignes_ordonnance_tmp_consultation_idx";
ALTER INDEX IF EXISTS "ordonnances_statut_idx" RENAME TO "lignes_ordonnance_statut_idx";

-- ── 2. L'ancienne table contenait des lignes : elle en prend le nom ──
ALTER TABLE "ordonnances" RENAME TO "lignes_ordonnance";

-- ── 3. La nouvelle table "ordonnances" porte le document ──
CREATE TABLE "ordonnances" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "statut" "StatutOrdonnance" NOT NULL DEFAULT 'EN_ATTENTE',
    "codeVerification" TEXT NOT NULL,
    "valideJusquau" TIMESTAMP(3) NOT NULL,
    "urlDocument" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifieLe" TIMESTAMP(3) NOT NULL,
    "idConsultation" TEXT NOT NULL,
    "signePar" TEXT,
    "signeLe" TIMESTAMP(3),

    CONSTRAINT "ordonnances_pkey" PRIMARY KEY ("id")
);

-- ── 4. Un document par consultation ayant au moins une ligne ──
-- L'identifiant du document est derive de celui de la consultation : la
-- reprise des lignes a l'etape 5 n'a alors besoin d'aucune table de
-- correspondance.
INSERT INTO "ordonnances" (
    "id", "numero", "statut", "codeVerification", "valideJusquau",
    "creeLe", "modifieLe", "idConsultation", "signePar", "signeLe"
)
SELECT
    'ord_' || md5(g."idConsultation"),
    'OR-' || to_char(g."premiereLigne", 'YYYY') || '-' || lpad(
        (row_number() OVER (
            PARTITION BY date_part('year', g."premiereLigne")
            ORDER BY g."premiereLigne", g."idConsultation"
        ))::text, 6, '0'),
    g."statut",
    -- md5 ne produit que des caracteres hexadecimaux ; on ecarte 0 et 1, seuls
    -- ambigus a la lecture, pour un code qui se dicte au telephone.
    upper(substr(translate(md5(g."idConsultation" || 'kv'), '01', 'xy'), 1, 6)),
    -- Les ordonnances anterieures a P3 n'avaient pas de duree : on leur en
    -- donne une de 90 jours a partir de leur emission. Les nouvelles liront le
    -- parametre systeme.
    g."premiereLigne" + INTERVAL '90 days',
    g."premiereLigne",
    CURRENT_TIMESTAMP,
    g."idConsultation",
    g."signePar",
    g."signeLe"
FROM (
    SELECT
        l."idConsultation",
        min(l."creeLe") AS "premiereLigne",
        max(l."signeLe") AS "signeLe",
        (array_agg(l."signePar") FILTER (WHERE l."signePar" IS NOT NULL))[1] AS "signePar",
        CASE
            WHEN bool_and(l."statut" = 'DELIVREE') THEN 'SERVIE'
            WHEN bool_or(l."statut" = 'DELIVREE') THEN 'PARTIELLEMENT_SERVIE'
            WHEN bool_and(l."statut" = 'ANNULEE') THEN 'ANNULEE'
            WHEN bool_and(l."statut" = 'EXPIREE') THEN 'EXPIREE'
            ELSE 'EN_ATTENTE'
        END::"StatutOrdonnance" AS "statut"
    FROM "lignes_ordonnance" l
    GROUP BY l."idConsultation"
) g;

-- ── 5. Rattacher les lignes a leur document ──
ALTER TABLE "lignes_ordonnance" ADD COLUMN "idOrdonnance" TEXT;
UPDATE "lignes_ordonnance" SET "idOrdonnance" = 'ord_' || md5("idConsultation");
ALTER TABLE "lignes_ordonnance" ALTER COLUMN "idOrdonnance" SET NOT NULL;

-- Ce qui appartenait au document quitte la ligne.
ALTER TABLE "lignes_ordonnance" DROP COLUMN "idConsultation";
ALTER TABLE "lignes_ordonnance" DROP COLUMN "urlDocument";
ALTER TABLE "lignes_ordonnance" DROP COLUMN "signePar";
ALTER TABLE "lignes_ordonnance" DROP COLUMN "signeLe";

-- ── 6. Index et cles etrangeres ──
CREATE UNIQUE INDEX "ordonnances_numero_key" ON "ordonnances"("numero");
CREATE INDEX "ordonnances_idConsultation_idx" ON "ordonnances"("idConsultation");
CREATE INDEX "ordonnances_statut_idx" ON "ordonnances"("statut");
CREATE INDEX "ordonnances_valideJusquau_idx" ON "ordonnances"("valideJusquau");

DROP INDEX IF EXISTS "lignes_ordonnance_tmp_consultation_idx";
CREATE INDEX "lignes_ordonnance_idOrdonnance_idx" ON "lignes_ordonnance"("idOrdonnance");

ALTER TABLE "ordonnances" ADD CONSTRAINT "ordonnances_idConsultation_fkey"
    FOREIGN KEY ("idConsultation") REFERENCES "consultations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ordonnances" ADD CONSTRAINT "ordonnances_signePar_fkey"
    FOREIGN KEY ("signePar") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "lignes_ordonnance" ADD CONSTRAINT "lignes_ordonnance_idOrdonnance_fkey"
    FOREIGN KEY ("idOrdonnance") REFERENCES "ordonnances"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lignes_ordonnance" ADD CONSTRAINT "lignes_ordonnance_idMedicament_fkey"
    FOREIGN KEY ("idMedicament") REFERENCES "medicaments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── 7. Aligner le compteur sur les numeros deja attribues ──
-- Sans cela, la premiere ordonnance emise apres la migration reprendrait a
-- OR-AAAA-000001 et violerait l'unicite du numero.
INSERT INTO "compteurs" ("cle", "valeur")
SELECT 'OR-' || to_char("creeLe", 'YYYY'), count(*)
FROM "ordonnances"
GROUP BY to_char("creeLe", 'YYYY')
ON CONFLICT ("cle") DO UPDATE SET "valeur" = GREATEST("compteurs"."valeur", EXCLUDED."valeur");

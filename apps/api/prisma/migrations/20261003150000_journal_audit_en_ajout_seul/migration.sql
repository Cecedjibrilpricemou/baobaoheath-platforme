-- Le journal d'audit nomme le patient concerne, et son ajout seul couvre
-- enfin TRUNCATE. EF-02-08 (journal des acces consultable par le patient) et
-- EF-12-04 (journal non modifiable).
--
-- CE QUI EXISTAIT DEJA, et qu'il ne faut pas redoubler : la migration
-- 20260619030000_immutable_audit_log pose un declencheur
-- `trg_journal_audit_immutable` qui refuse UPDATE et DELETE sur la table, via
-- la fonction `prevent_audit_mutation()`. L'ajout seul n'est donc pas une
-- nouveaute de ce jour. La feuille de route comptait EF-12-04 comme non
-- commence ; c'est faux pour cette partie.
--
-- LE TROU QU'IL RESTAIT : ce declencheur est `FOR EACH ROW BEFORE UPDATE OR
-- DELETE`. TRUNCATE n'y figure pas, et TRUNCATE ne declenche jamais un
-- declencheur de ligne. `TRUNCATE journal_audit` videsait donc le journal
-- entier sans rencontrer d'obstacle — decouvert le 2026-10-03 en eprouvant la
-- table sur une base jetable. La section 5 le ferme.
--
-- Prisma proposait les sections 1 a 3, et rien de destructif cette fois.

-- ─── 1. Les colonnes ────────────────────────────────────────────────
ALTER TABLE "journal_audit" ADD COLUMN "idPatientConcerne" TEXT,
                            ADD COLUMN "statutHttp" INTEGER;

-- ─── 2. Les index de recherche (EF-12-05) ───────────────────────────
CREATE INDEX "journal_audit_idPatientConcerne_creeLe_idx" ON "journal_audit"("idPatientConcerne", "creeLe");
CREATE INDEX "journal_audit_idUtilisateur_creeLe_idx" ON "journal_audit"("idUtilisateur", "creeLe");
CREATE INDEX "journal_audit_creeLe_idx" ON "journal_audit"("creeLe");

-- ─── 3. La cle etrangere ────────────────────────────────────────────
-- ON DELETE RESTRICT : un effacement RGPD ne doit pas pouvoir faire
-- disparaitre la trace des acces au dossier.
ALTER TABLE "journal_audit" ADD CONSTRAINT "journal_audit_idPatientConcerne_fkey"
  FOREIGN KEY ("idPatientConcerne") REFERENCES "patients"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── 4. Reprise des lignes deja ecrites ─────────────────────────────
-- Les anciennes lignes portent l'information dans `metadonnees`, en JSON non
-- indexe. On la remonte dans les colonnes, pour que le journal du patient
-- commence a sa premiere lecture et non a cette migration.
--
-- Le declencheur d'ajout seul interdit les UPDATE — y compris celui-ci. Il
-- est donc desactive le temps de la reprise, puis remis. C'est volontaire et
-- borne : une migration de schema a legitimement besoin de reecrire des
-- colonnes, l'ensemble tient dans la transaction de la migration, et la table
-- ressort protegee. Toute autre voie que ce fichier reste fermee.
ALTER TABLE "journal_audit" DISABLE TRIGGER "trg_journal_audit_immutable";

-- Le code HTTP etait deja la, sous `metadonnees.statusCode`.
UPDATE "journal_audit"
SET "statutHttp" = ("metadonnees" ->> 'statusCode')::INTEGER
WHERE "metadonnees" ->> 'statusCode' ~ '^[0-9]+$';

-- Cas 1 : la ressource visee EST le patient (`/patients/:id`).
UPDATE "journal_audit" j
SET "idPatientConcerne" = j."idRessource"
WHERE j."idPatientConcerne" IS NULL
  AND j."ressource" = 'patients'
  AND j."idRessource" IS NOT NULL
  AND EXISTS (SELECT 1 FROM "patients" p WHERE p."id" = j."idRessource");

-- Cas 2 : le scan d'un QR. C'est le trou que le commentaire du 2026-09-29
-- signalait : le patient n'existait que dans `metadonnees.params.qrCode`.
UPDATE "journal_audit" j
SET "idPatientConcerne" = p."id"
FROM "patients" p
WHERE j."idPatientConcerne" IS NULL
  AND p."qrCode" = j."metadonnees" -> 'params' ->> 'qrCode';

-- Cas 3 : une consultation, donc le patient de cette consultation.
UPDATE "journal_audit" j
SET "idPatientConcerne" = c."idPatient"
FROM "consultations" c
WHERE j."idPatientConcerne" IS NULL
  AND j."ressource" = 'consultations'
  AND c."id" = j."idRessource";

ALTER TABLE "journal_audit" ENABLE TRIGGER "trg_journal_audit_immutable";

-- ─── 5. TRUNCATE, le trou qui restait ───────────────────────────────
-- Un declencheur de ligne ne voit pas TRUNCATE : il lui faut un declencheur
-- d'instruction. La fonction existante convient telle quelle — elle ne lit
-- que TG_OP, pas OLD. On la reecrit seulement pour son message : il etait en
-- anglais et ne citait pas la regle, alors que c'est ce message que lira
-- l'operateur confronte au refus.
CREATE OR REPLACE FUNCTION prevent_audit_mutation() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION
    'EF-12-04 : le journal d''audit est en ajout seul, % est refuse sur journal_audit.',
    TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

--
-- La limite, dite franchement : le proprietaire de la table peut supprimer ce
-- declencheur, ou le desactiver comme la section 4 vient de le faire. Il
-- ferme la porte a une erreur de code ou de script, pas a un administrateur
-- de base determine. Une inviolabilite complete suppose des droits restreints
-- au niveau du SGBD, voire un stockage en ecriture unique.
CREATE TRIGGER "trg_journal_audit_pas_de_troncature"
  BEFORE TRUNCATE ON "journal_audit"
  FOR EACH STATEMENT EXECUTE FUNCTION prevent_audit_mutation();

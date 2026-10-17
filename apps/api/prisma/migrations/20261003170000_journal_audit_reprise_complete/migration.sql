-- Reprise complete du journal : tout ce que l'ancienne requete savait
-- trouver doit se retrouver dans la colonne indexee.
--
-- POURQUOI CE SECOND PASSAGE. La migration 20261003150000 a repris trois cas
-- (fiche patient, scan de QR, consultation). Mesure faite le 2026-10-03 sur
-- la base de demonstration : la nouvelle requete indexee trouvait 30 scans de
-- QR que l'ancienne requete JSON n'avait jamais vus — le trou nomme le
-- 2026-09-29 — mais elle manquait 33 lignes que l'ancienne trouvait, des
-- ecritures d'assurance portant `body.idPatient` (POST /contrats,
-- /eligibilite, /simulation, /ventes).
--
-- Basculer la lecture sur la colonne sans ce passage aurait donc fait
-- DISPARAITRE des acces du journal d'un patient. Un journal qui perd des
-- lignes est pire qu'un journal lent.
--
-- Ce fichier reprend donc exactement les clauses de l'ancienne requete, plus
-- les ressources rattachees que le resolveur sait remonter en service, pour
-- que la colonne soit un sur-ensemble strict de ce qui etait trouvable avant.

-- Meme raison et meme encadrement qu'au premier passage : la reprise est un
-- UPDATE, que le declencheur d'ajout seul interdit. Il est desactive le temps
-- de la transaction, puis remis.
ALTER TABLE "journal_audit" DISABLE TRIGGER "trg_journal_audit_immutable";

-- ─── Les clauses de l'ancienne requete ──────────────────────────────

-- `metadonnees.params.id` : la fiche patient, quelle que soit la ressource
-- enregistree. C'est ce qui rattrape les lignes ecrites quand la colonne
-- `ressource` etait fausse (voir le commentaire de `cheminComplet`).
UPDATE "journal_audit" j
SET "idPatientConcerne" = p."id"
FROM "patients" p
WHERE j."idPatientConcerne" IS NULL
  AND p."id" = j."metadonnees" -> 'params' ->> 'id';

-- `metadonnees.body.idPatient` : les ecritures d'assurance, de vente, de
-- rendez-vous.
UPDATE "journal_audit" j
SET "idPatientConcerne" = p."id"
FROM "patients" p
WHERE j."idPatientConcerne" IS NULL
  AND p."id" = j."metadonnees" -> 'body' ->> 'idPatient';

-- `metadonnees.query.idPatient` : les listes filtrees sur un patient.
UPDATE "journal_audit" j
SET "idPatientConcerne" = p."id"
FROM "patients" p
WHERE j."idPatientConcerne" IS NULL
  AND p."id" = j."metadonnees" -> 'query' ->> 'idPatient';

-- `idRessource` seul : l'ancienne requete l'acceptait sans regarder la
-- ressource. On garde la meme largeur, en verifiant que l'identifiant
-- designe bien un patient.
UPDATE "journal_audit" j
SET "idPatientConcerne" = p."id"
FROM "patients" p
WHERE j."idPatientConcerne" IS NULL
  AND p."id" = j."idRessource";

-- ─── Les ressources rattachees, comme en service ────────────────────
-- Le resolveur remonte au patient depuis une consultation, un episode, une
-- vaccination ou une ordonnance. Les lignes anciennes meritent la meme
-- lecture. La ressource enregistree n'etant pas fiable sur ces lignes, on se
-- fie a l'identifiant seul : un identifiant d'episode ne peut pas etre aussi
-- un identifiant de vaccination.

UPDATE "journal_audit" j
SET "idPatientConcerne" = c."idPatient"
FROM "consultations" c
WHERE j."idPatientConcerne" IS NULL
  AND c."id" = COALESCE(j."idRessource", j."metadonnees" -> 'params' ->> 'id');

UPDATE "journal_audit" j
SET "idPatientConcerne" = e."idPatient"
FROM "episodes_soins" e
WHERE j."idPatientConcerne" IS NULL
  AND e."id" = COALESCE(j."idRessource", j."metadonnees" -> 'params' ->> 'id');

UPDATE "journal_audit" j
SET "idPatientConcerne" = v."idPatient"
FROM "vaccinations" v
WHERE j."idPatientConcerne" IS NULL
  AND v."id" = COALESCE(j."idRessource", j."metadonnees" -> 'params' ->> 'id');

-- L'ordonnance passe par sa consultation : elle ne porte pas d'idPatient.
UPDATE "journal_audit" j
SET "idPatientConcerne" = c."idPatient"
FROM "ordonnances" o
JOIN "consultations" c ON c."id" = o."idConsultation"
WHERE j."idPatientConcerne" IS NULL
  AND o."id" = COALESCE(j."idRessource", j."metadonnees" -> 'params' ->> 'id');

-- ─── Le patient qui lisait son propre dossier ───────────────────────
-- Les routes /me/... n'enregistraient aucun identifiant de patient : seul
-- l'auteur de la requete permet de les rattacher. 273 lignes dans la base de
-- demonstration.
UPDATE "journal_audit" j
SET "idPatientConcerne" = p."id"
FROM "patients" p
WHERE j."idPatientConcerne" IS NULL
  AND p."idUtilisateur" = j."idUtilisateur"
  AND j."metadonnees" ->> 'originalUrl' LIKE '%/me%';

ALTER TABLE "journal_audit" ENABLE TRIGGER "trg_journal_audit_immutable";

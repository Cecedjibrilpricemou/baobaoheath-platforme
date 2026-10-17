-- L'acte de delivrance : qui, combien, quoi, et pourquoi (EF-07-03/04/05/07).
--
-- **Ce que la base ne savait pas.** `delivrerLigneOrdonnance` recevait une
-- `quantiteDelivree`, la renvoyait a l'appelant et ne l'ecrivait nulle part :
-- la ligne passait a DELIVREE quelle que soit la quantite remise. Une officine
-- qui n'avait que trois boites sur dix en remettait trois, la ligne se
-- declarait servie, le reste ne pouvait plus jamais etre delivre, et
-- l'ordonnance s'annoncait servie. La delivrance partielle (EF-07-07) etait
-- dans le contrat, dans la signature de la fonction, et nulle part en base.
--
-- **L'auteur est nominatif** (EF-07-03). Savoir quelle officine a delivre ne
-- suffit pas : c'est une personne qui engage sa responsabilite en remettant un
-- medicament, et c'est elle qu'on cherche quand quelque chose a mal tourne.
--
-- Une substitution et un refus ne sont pas des variantes silencieuses d'une
-- delivrance : ils ont leur type, et leur motif est exige.

CREATE TYPE "TypeActeDelivrance" AS ENUM ('DELIVRE', 'SUBSTITUE', 'REFUSE');

CREATE TABLE "actes_delivrance" (
    "id" TEXT NOT NULL,
    "type" "TypeActeDelivrance" NOT NULL,
    "quantite" INTEGER NOT NULL,
    "prixUnitaireGnf" INTEGER NOT NULL DEFAULT 0,
    "montantGnf" INTEGER NOT NULL DEFAULT 0,
    "motif" TEXT,
    "acteLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idLigneOrdonnance" TEXT NOT NULL,
    "idStructure" TEXT NOT NULL,
    "idPharmacien" TEXT NOT NULL,
    "idMedicamentDelivre" TEXT NOT NULL,

    CONSTRAINT "actes_delivrance_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "actes_delivrance_idLigneOrdonnance_idx" ON "actes_delivrance"("idLigneOrdonnance");
CREATE INDEX "actes_delivrance_idStructure_acteLe_idx" ON "actes_delivrance"("idStructure", "acteLe");

ALTER TABLE "actes_delivrance" ADD CONSTRAINT "actes_delivrance_idLigneOrdonnance_fkey" FOREIGN KEY ("idLigneOrdonnance") REFERENCES "lignes_ordonnance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "actes_delivrance" ADD CONSTRAINT "actes_delivrance_idStructure_fkey" FOREIGN KEY ("idStructure") REFERENCES "structures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "actes_delivrance" ADD CONSTRAINT "actes_delivrance_idPharmacien_fkey" FOREIGN KEY ("idPharmacien") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "actes_delivrance" ADD CONSTRAINT "actes_delivrance_idMedicamentDelivre_fkey" FOREIGN KEY ("idMedicamentDelivre") REFERENCES "medicaments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Ce qui ne peut pas etre incoherent ───────────────────────────────

-- Un refus ne remet rien ; une delivrance remet quelque chose. Un acte de
-- quantite nulle qui se declarerait « delivre » gonflerait le total servi
-- sans que rien ne soit sorti du stock.
ALTER TABLE "actes_delivrance" ADD CONSTRAINT "actes_delivrance_quantite_suit_le_type"
  CHECK (
    CASE WHEN "type" = 'REFUSE' THEN "quantite" = 0 ELSE "quantite" > 0 END
  );

ALTER TABLE "actes_delivrance" ADD CONSTRAINT "actes_delivrance_montant_coherent"
  CHECK ("montantGnf" = "quantite" * "prixUnitaireGnf" AND "prixUnitaireGnf" >= 0);

-- **Un refus ou une substitution sans motif ne s'explique pas.** Le patient
-- repart sans savoir s'il doit revenir, aller ailleurs, ou rappeler son
-- medecin ; et le prescripteur ne sait pas que son traitement a change.
ALTER TABLE "actes_delivrance" ADD CONSTRAINT "actes_delivrance_motif_exige"
  CHECK (
    "type" = 'DELIVRE'
    OR ("motif" IS NOT NULL AND length(btrim("motif")) >= 5)
  );

-- ── On ne delivre pas plus que ce qui est prescrit ───────────────────
--
-- La verification porte sur deux tables : aucune CHECK ne peut l'exprimer. Un
-- declencheur **differe** la repousse au commit, ce qui laisse une
-- transaction inserer son acte et mettre le statut de la ligne a jour avant
-- d'etre jugee.
--
-- Pourquoi la faire en base plutot que de s'en remettre au service : il
-- s'agit de medicaments, dont certains sont reglementes. Un futur appel qui
-- oublierait de sommer les actes anterieurs delivrerait deux fois la meme
-- ordonnance, et personne ne le verrait avant un inventaire.
CREATE OR REPLACE FUNCTION acte_delivrance_dans_le_prescrit() RETURNS TRIGGER AS $$
DECLARE
  cible    TEXT;
  prescrit INTEGER;
  servi    INTEGER;
BEGIN
  cible := COALESCE(NEW."idLigneOrdonnance", OLD."idLigneOrdonnance");

  SELECT l."quantite" INTO prescrit FROM "lignes_ordonnance" l WHERE l."id" = cible;
  -- La ligne a pu disparaitre dans la meme transaction (suppression en
  -- cascade) : il n'y a alors plus rien a verifier.
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT COALESCE(SUM(a."quantite"), 0) INTO servi
  FROM "actes_delivrance" a WHERE a."idLigneOrdonnance" = cible;

  IF servi > prescrit THEN
    RAISE EXCEPTION
      'ligne % : % unites delivrees pour % prescrites',
      cible, servi, prescrit;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "actes_delivrance_dans_le_prescrit"
  AFTER INSERT OR UPDATE ON "actes_delivrance"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION acte_delivrance_dans_le_prescrit();

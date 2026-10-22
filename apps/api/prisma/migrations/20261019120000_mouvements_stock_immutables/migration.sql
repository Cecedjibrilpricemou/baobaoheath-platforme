-- Les quantites sont des variations signees : entrees positives, sorties
-- negatives. Les ajustements et corrections gardent leur signe reel.
ALTER TABLE "mouvements_stock"
  ADD CONSTRAINT "mouvements_stock_sens_quantite_check"
  CHECK (
    ("type" = 'ENTREE' AND "quantite" > 0)
    OR ("type" = 'SORTIE' AND "quantite" < 0)
    OR ("type" IN ('AJUSTEMENT', 'CORRECTION') AND "quantite" <> 0)
  );

CREATE OR REPLACE FUNCTION prevent_mouvement_stock_mutation() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION
    'Le registre des mouvements de stock est en ajout seul : % est refuse.',
    TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "trg_mouvements_stock_immutable"
  BEFORE UPDATE OR DELETE ON "mouvements_stock"
  FOR EACH ROW EXECUTE FUNCTION prevent_mouvement_stock_mutation();

CREATE TRIGGER "trg_mouvements_stock_pas_de_troncature"
  BEFORE TRUNCATE ON "mouvements_stock"
  FOR EACH STATEMENT EXECUTE FUNCTION prevent_mouvement_stock_mutation();

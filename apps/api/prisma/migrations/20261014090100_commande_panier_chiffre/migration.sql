-- Le panier chiffre d'une commande, et ce qui ne peut pas etre incoherent.
--
-- EF-07-02. Jusqu'ici `CommandeView.lignes` etait **derive de l'ordonnance** :
-- aucun prix, aucun libelle fige, rien a payer. Le patient voyait ce qui lui
-- etait prescrit, jamais ce qu'il allait debourser.
--
-- Les libelles et les prix sont figes dans `lignes_commande`, pas lus du
-- catalogue a l'affichage : le catalogue national evolue et les marges d'une
-- officine aussi, et ce que le patient a accepte de payer ce jour-la ne doit
-- pas bouger derriere lui. Le prix suit exactement la regle du comptoir —
-- prix national de reference plus la marge de l'officine — parce que deux
-- regles de prix divergeraient en silence.

-- ── Le panier ────────────────────────────────────────────────────────
ALTER TABLE "commandes" ADD COLUMN     "chiffreeLe" TIMESTAMP(3),
ADD COLUMN     "clotureeLe" TIMESTAMP(3),
ADD COLUMN     "montantTotalGnf" INTEGER,
ADD COLUMN     "motifAnnulation" TEXT,
ADD COLUMN     "preteLe" TIMESTAMP(3),
ADD COLUMN     "remiseLe" TIMESTAMP(3);

ALTER TABLE "factures" ADD COLUMN "idCommande" TEXT;

CREATE TABLE "lignes_commande" (
    "id" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "quantite" INTEGER NOT NULL,
    "prixUnitaireGnf" INTEGER NOT NULL,
    "montantGnf" INTEGER NOT NULL,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idCommande" TEXT NOT NULL,
    "idLigneOrdonnance" TEXT NOT NULL,
    "idMedicament" TEXT NOT NULL,

    CONSTRAINT "lignes_commande_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "lignes_commande_idCommande_idx" ON "lignes_commande"("idCommande");
CREATE UNIQUE INDEX "lignes_commande_idCommande_idLigneOrdonnance_key" ON "lignes_commande"("idCommande", "idLigneOrdonnance");
CREATE UNIQUE INDEX "factures_idCommande_key" ON "factures"("idCommande");

ALTER TABLE "factures" ADD CONSTRAINT "factures_idCommande_fkey" FOREIGN KEY ("idCommande") REFERENCES "commandes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "lignes_commande" ADD CONSTRAINT "lignes_commande_idCommande_fkey" FOREIGN KEY ("idCommande") REFERENCES "commandes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lignes_commande" ADD CONSTRAINT "lignes_commande_idMedicament_fkey" FOREIGN KEY ("idMedicament") REFERENCES "medicaments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Ce qui ne peut pas etre incoherent ───────────────────────────────
--
-- Une machine a etats vit dans le service, donc elle peut etre contournee :
-- un script de reprise, une correction a la main, un futur appel qui oublie
-- de passer par la fonction. Ce qui suit refuse les etats impossibles au
-- niveau de la base, la ou rien ne passe a cote.

-- Une ligne dont le montant ne serait pas le produit de sa quantite par son
-- prix unitaire ouvrirait un ecart entre ce qui est affiche et ce qui est du.
ALTER TABLE "lignes_commande" ADD CONSTRAINT "lignes_commande_montant_coherent"
  CHECK ("montantGnf" = "quantite" * "prixUnitaireGnf");

ALTER TABLE "lignes_commande" ADD CONSTRAINT "lignes_commande_quantite_positive"
  CHECK ("quantite" > 0 AND "prixUnitaireGnf" >= 0);

-- Au-dela de la recherche, une commande a forcement une pharmacie : c'est
-- elle qui chiffre, prepare et remet. Les deux etats d'echec en sont exempts.
ALTER TABLE "commandes" ADD CONSTRAINT "commandes_pharmacie_exigee"
  CHECK (
    "statut" IN ('RECHERCHE_PHARMACIE', 'SANS_PHARMACIE', 'ANNULEE')
    OR "idPharmacie" IS NOT NULL
  );

-- Des que le panier est chiffre, il porte un total et une date de chiffrage.
-- Un ecran qui afficherait « a payer » sans montant ne sert a rien.
ALTER TABLE "commandes" ADD CONSTRAINT "commandes_total_exige_apres_chiffrage"
  CHECK (
    "statut" NOT IN ('A_PAYER', 'PAYEE', 'EN_PREPARATION', 'PRETE_POUR_RETRAIT',
                     'PRETE_POUR_LIVRAISON', 'RETIREE', 'CLOTUREE')
    OR ("montantTotalGnf" IS NOT NULL AND "chiffreeLe" IS NOT NULL)
  );

-- **Le mode de remise decide de la sortie.** Une commande prete pour retrait
-- alors que le patient a demande une livraison est une contradiction : l'un
-- des deux ecrans mentirait.
--
-- **`modeRemise IS NOT NULL` est exige explicitement**, et ce n'est pas une
-- redondance. La premiere version s'ecrivait
--   (statut <> 'PRETE_POUR_RETRAIT' OR "modeRemise" = 'RETRAIT_PHARMACIE')
-- et laissait passer une commande prete pour retrait sans mode choisi : en
-- logique a trois valeurs, `NULL = 'RETRAIT_PHARMACIE'` vaut NULL, donc
-- `FALSE OR NULL` vaut NULL — et une CHECK qui vaut NULL **accepte**. Le
-- trou a ete trouve en regardant la garde refuser, pas en la relisant.
--
-- Les etats qui suivent y sont inclus : le mode ne doit pas pouvoir
-- disparaitre apres coup.
ALTER TABLE "commandes" ADD CONSTRAINT "commandes_sortie_suit_le_mode"
  CHECK (
    "statut" NOT IN ('PRETE_POUR_RETRAIT', 'PRETE_POUR_LIVRAISON', 'RETIREE', 'CLOTUREE')
    OR (
      "modeRemise" IS NOT NULL
      AND ("statut" <> 'PRETE_POUR_RETRAIT'    OR "modeRemise" = 'RETRAIT_PHARMACIE')
      AND ("statut" <> 'PRETE_POUR_LIVRAISON' OR "modeRemise" = 'LIVRAISON')
    )
  );

-- Les horodatages suivent les etats qu'ils datent. Sans cela, une commande
-- « remise » sans date de remise se relit trois semaines plus tard sans qu'on
-- sache quand elle est partie.
ALTER TABLE "commandes" ADD CONSTRAINT "commandes_horodatages_coherents"
  CHECK (
    ("statut" NOT IN ('PRETE_POUR_RETRAIT', 'PRETE_POUR_LIVRAISON', 'RETIREE', 'CLOTUREE')
      OR "preteLe" IS NOT NULL)
    AND ("statut" NOT IN ('RETIREE', 'CLOTUREE') OR "remiseLe" IS NOT NULL)
    AND ("statut" <> 'CLOTUREE' OR "clotureeLe" IS NOT NULL)
  );

-- Le pendant de `ventes_comptoir_annulation_motivee` : une annulation sans
-- motif ne s'explique pas, et c'est toujours a ce moment qu'on la cherche.
ALTER TABLE "commandes" ADD CONSTRAINT "commandes_annulation_motivee"
  CHECK ("statut" <> 'ANNULEE' OR ("motifAnnulation" IS NOT NULL AND length(btrim("motifAnnulation")) > 0));

-- Une facture regle une consultation **ou** une commande, jamais les deux.
-- Elle peut n'en regler aucune : c'est deja le cas aujourd'hui.
ALTER TABLE "factures" ADD CONSTRAINT "factures_cible_unique"
  CHECK (NOT ("idConsultation" IS NOT NULL AND "idCommande" IS NOT NULL));

-- ── Le total s'accorde avec ses lignes ───────────────────────────────
--
-- Cette verification porte sur deux tables : aucune CHECK ne peut l'exprimer.
-- Un declencheur **differe** la repousse jusqu'au commit, sans quoi il
-- echouerait au milieu de l'insertion des lignes, alors que le total n'est
-- pas encore pose.
--
-- Pourquoi la faire au lieu de s'en remettre au service : le total est
-- redondant avec les lignes, et une redondance sans garde finit toujours par
-- divulguer un ecart — ici, entre ce que l'ecran annonce et ce qui est du.
CREATE OR REPLACE FUNCTION commande_total_suit_ses_lignes() RETURNS TRIGGER AS $$
DECLARE
  cible  TEXT;
  total  INTEGER;
  somme  INTEGER;
BEGIN
  -- Le declencheur sert les deux tables : la commande se designe par `id`,
  -- une ligne par `idCommande`.
  IF TG_TABLE_NAME = 'commandes' THEN
    cible := COALESCE(NEW."id", OLD."id");
  ELSE
    cible := COALESCE(NEW."idCommande", OLD."idCommande");
  END IF;

  SELECT c."montantTotalGnf" INTO total FROM "commandes" c WHERE c."id" = cible;
  -- La commande a pu disparaitre dans la meme transaction (suppression en
  -- cascade) : il n'y a alors plus rien a verifier.
  IF NOT FOUND THEN RETURN NULL; END IF;
  -- Pas encore chiffree : les lignes peuvent exister sans total.
  IF total IS NULL THEN RETURN NULL; END IF;

  SELECT COALESCE(SUM(l."montantGnf"), 0) INTO somme
  FROM "lignes_commande" l WHERE l."idCommande" = cible;

  IF somme <> total THEN
    RAISE EXCEPTION
      'commande % : le total (%) ne correspond pas a la somme de ses lignes (%)',
      cible, total, somme;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "lignes_commande_total_coherent"
  AFTER INSERT OR UPDATE OR DELETE ON "lignes_commande"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION commande_total_suit_ses_lignes();

CREATE CONSTRAINT TRIGGER "commandes_total_coherent"
  AFTER UPDATE OF "montantTotalGnf" ON "commandes"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION commande_total_suit_ses_lignes();

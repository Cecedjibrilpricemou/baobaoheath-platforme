-- La vente au comptoir peut attendre son paiement (EF-08).
--
-- Jusqu'ici le pharmacien cochait « Orange Money » et la vente naissait
-- PAYEE, sans qu'un seul franc ait bouge : rien ne verifiait que l'argent
-- etait arrive. Un paiement mobile prend quelques secondes pendant lesquelles
-- la vente existe sans etre reglee, et les medicaments ne se remettent pas
-- avant.
--
-- `ADD VALUE` tient dans une transaction depuis PostgreSQL 12 tant que la
-- valeur n'est pas employee dans la meme transaction. Elle ne l'est pas ici.
ALTER TYPE "StatutVente" ADD VALUE 'EN_ATTENTE';

-- `idOperation` est la cle stable cote passerelle : on relit le statut par
-- elle, jamais par le numero de commande, qu'un meme client peut porter sur
-- plusieurs operations.
ALTER TABLE "ventes_comptoir"
  ADD COLUMN "idOperation"          TEXT,
  ADD COLUMN "urlPaiement"          TEXT,
  ADD COLUMN "statutOperateur"      TEXT,
  ADD COLUMN "referenceTransaction" TEXT;

CREATE UNIQUE INDEX "ventes_comptoir_idOperation_key"
  ON "ventes_comptoir"("idOperation");

-- Une vente payee doit porter sa preuve ou n'etre jamais passee par la
-- passerelle. L'etat interdit est celui qui mentirait : « payee par
-- operation », sans reference de transaction.
ALTER TABLE "ventes_comptoir"
  ADD CONSTRAINT "ventes_comptoir_preuve_si_passerelle"
  CHECK (
    "statut" <> 'PAYEE'
    OR "idOperation" IS NULL
    OR "referenceTransaction" IS NOT NULL
  );

-- Une vente en attente n'a de sens que par une passerelle : sans operation,
-- rien ne la fera jamais aboutir et elle resterait a bloquer des lots.
ALTER TABLE "ventes_comptoir"
  ADD CONSTRAINT "ventes_comptoir_attente_avec_operation"
  CHECK ("statut" <> 'EN_ATTENTE' OR "idOperation" IS NOT NULL);

-- La facture garde le lien de paiement de la passerelle et le dernier statut
-- connu (Chap Chap Pay, EF-08).
--
-- Seul `success` fait passer la facture a PAYEE : un paiement annule, echoue
-- ou expire la laisse payable, pour que le patient recommence sans repasser
-- au guichet. `statutOperateur` existe pour que l'ecran dise ce qui s'est
-- passe sans rappeler la passerelle a chaque affichage.
ALTER TABLE "factures" ADD COLUMN "statutOperateur" TEXT,
                       ADD COLUMN "urlPaiement" TEXT;

-- Les etats de la commande, au-dela de la prise en charge.
--
-- Separee de la migration suivante a dessein : PostgreSQL refuse d'utiliser
-- une valeur d'enum dans la meme transaction que celle qui la cree. Les
-- contraintes de la migration suivante nomment ces valeurs, donc elles ne
-- peuvent pas vivre ici.
--
-- Le tronc commun : PRISE_EN_CHARGE -> A_PAYER -> PAYEE -> EN_PREPARATION,
-- puis deux sorties selon le mode de remise choisi par le patient.
--
-- PRETE_POUR_LIVRAISON est le point de jonction avec P8 : l'enchere des
-- motards, le suivi et la preuve de remise commencent la. On ne cree pas les
-- etats de P8 maintenant — un etat qu'aucun code ne pose ne se verifie pas.

ALTER TYPE "StatutCommande" ADD VALUE 'A_PAYER';
ALTER TYPE "StatutCommande" ADD VALUE 'PAYEE';
ALTER TYPE "StatutCommande" ADD VALUE 'EN_PREPARATION';
ALTER TYPE "StatutCommande" ADD VALUE 'PRETE_POUR_RETRAIT';
ALTER TYPE "StatutCommande" ADD VALUE 'PRETE_POUR_LIVRAISON';
ALTER TYPE "StatutCommande" ADD VALUE 'RETIREE';
ALTER TYPE "StatutCommande" ADD VALUE 'CLOTUREE';

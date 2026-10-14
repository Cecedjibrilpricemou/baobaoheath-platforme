-- Les evenements de la commande, au-dela de la prise en charge.
--
-- Reutiliser `COMMANDE_PRISE_EN_CHARGE` pour annoncer un panier chiffre, une
-- remise ou une annulation aurait marche — et aurait rendu le journal des
-- notifications illisible, puisque c'est ce type qui sert a filtrer et a
-- choisir l'icone. Un evenement qui n'a pas de nom ne se retrouve pas.

ALTER TYPE "TypeNotification" ADD VALUE 'COMMANDE_A_PAYER';
ALTER TYPE "TypeNotification" ADD VALUE 'COMMANDE_PAYEE';
ALTER TYPE "TypeNotification" ADD VALUE 'COMMANDE_PRETE';
ALTER TYPE "TypeNotification" ADD VALUE 'COMMANDE_REMISE';
ALTER TYPE "TypeNotification" ADD VALUE 'COMMANDE_ANNULEE';

-- Les deux evenements de comptoir qui changent un traitement.
--
-- Une substitution et un refus de ligne meritent leur nom : c'est ce type qui
-- sert a filtrer le journal des notifications et a choisir l'icone. Reutiliser
-- `ORDONNANCE_SIGNEE` aurait marche, et aurait rendu introuvable le jour ou un
-- medecin cherche « quand mon traitement a-t-il ete modifie ».

ALTER TYPE "TypeNotification" ADD VALUE 'ORDONNANCE_SUBSTITUTION';
ALTER TYPE "TypeNotification" ADD VALUE 'ORDONNANCE_LIGNE_REFUSEE';

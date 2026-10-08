-- L'assureur se connecte lui-meme (addendum du 2026-09-28, point 5.2).
--
-- Son agent appartient a la structure de type ASSURANCE rattachee a son
-- `Assureur` : sans role propre, il heriterait des droits d'un hopital ou
-- d'une pharmacie, et donc de l'acces aux dossiers medicaux.
--
-- `ADD VALUE` tient dans une transaction depuis PostgreSQL 12 tant que la
-- valeur n'est pas utilisee dans la meme transaction. Elle ne l'est pas ici.
ALTER TYPE "Role" ADD VALUE 'ASSUREUR';

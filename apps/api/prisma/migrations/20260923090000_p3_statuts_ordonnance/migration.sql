-- P3 / EF-05 : statuts de l'ordonnance-document.
--
-- Migration separee de la restructuration qui suit : PostgreSQL refuse
-- d'utiliser une valeur d'enum dans la transaction qui l'ajoute. Les deux
-- valeurs doivent donc etre commitees avant que la migration suivante ne
-- s'en serve pour qualifier les ordonnances existantes.

-- AlterEnum
ALTER TYPE "StatutOrdonnance" ADD VALUE IF NOT EXISTS 'PARTIELLEMENT_SERVIE';
ALTER TYPE "StatutOrdonnance" ADD VALUE IF NOT EXISTS 'SERVIE';

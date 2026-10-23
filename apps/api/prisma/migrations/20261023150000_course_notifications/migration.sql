-- PostgreSQL ne permet pas d'utiliser une nouvelle valeur d'enum avant la
-- validation de la transaction de migration. Cette migration ne fait que les ajouter.
ALTER TYPE "TypeNotification" ADD VALUE IF NOT EXISTS 'COURSE_OUVERTE';
ALTER TYPE "TypeNotification" ADD VALUE IF NOT EXISTS 'OFFRE_COURSE';
ALTER TYPE "TypeNotification" ADD VALUE IF NOT EXISTS 'COURSE_ATTRIBUEE';

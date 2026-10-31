-- Code PIN de la passerelle USSD.
--
-- Les trois colonnes sont facultatives ou ont une valeur par defaut : la
-- migration ne touche aucune ligne existante. Un patient sans PIN ne peut
-- plus consulter son dossier par USSD tant qu'il n'en a pas choisi un.
ALTER TABLE "patients" ADD COLUMN "pinUssdHash" TEXT;
ALTER TABLE "patients" ADD COLUMN "pinUssdEchecs" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "patients" ADD COLUMN "pinUssdBloqueJusqua" TIMESTAMP(3);

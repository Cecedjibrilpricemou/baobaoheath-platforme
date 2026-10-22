ALTER TABLE "ventes_comptoir"
    ADD COLUMN "idAutoriseePar" TEXT;

CREATE INDEX "ventes_comptoir_idAutoriseePar_idx"
    ON "ventes_comptoir"("idAutoriseePar");

ALTER TABLE "ventes_comptoir"
    ADD CONSTRAINT "ventes_comptoir_idAutoriseePar_fkey"
    FOREIGN KEY ("idAutoriseePar") REFERENCES "utilisateurs"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

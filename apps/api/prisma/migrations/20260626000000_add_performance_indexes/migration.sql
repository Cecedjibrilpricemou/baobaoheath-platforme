-- Performance indexes on high-traffic filtered FK columns

-- PatientProfile: filtered by prefecture and FK relations
CREATE INDEX IF NOT EXISTS "patients_prefecture_idx" ON "patients"("prefecture");
CREATE INDEX IF NOT EXISTS "patients_idStructurePreferee_idx" ON "patients"("idStructurePreferee");
CREATE INDEX IF NOT EXISTS "patients_idAscPrincipal_idx" ON "patients"("idAscPrincipal");

-- Consultation: filtered by patient, ASC, medecin, status
CREATE INDEX IF NOT EXISTS "consultations_idPatient_consulteeLE_idx" ON "consultations"("idPatient", "consulteeLE" DESC);
CREATE INDEX IF NOT EXISTS "consultations_idAsc_idx" ON "consultations"("idAsc");
CREATE INDEX IF NOT EXISTS "consultations_idMedecinValideur_idx" ON "consultations"("idMedecinValideur");
CREATE INDEX IF NOT EXISTS "consultations_statut_idx" ON "consultations"("statut");

-- Diagnostic: filtered by consultation and for epidemiology queries
CREATE INDEX IF NOT EXISTS "diagnostics_idConsultation_idx" ON "diagnostics"("idConsultation");
CREATE INDEX IF NOT EXISTS "diagnostics_creeLe_libelle_idx" ON "diagnostics"("creeLe", "libelle");

-- Ordonnance: filtered by consultation and status
CREATE INDEX IF NOT EXISTS "ordonnances_idConsultation_idx" ON "ordonnances"("idConsultation");
CREATE INDEX IF NOT EXISTS "ordonnances_statut_idx" ON "ordonnances"("statut");

-- Vaccination: filtered by patient and upcoming date
CREATE INDEX IF NOT EXISTS "vaccinations_idPatient_administreLe_idx" ON "vaccinations"("idPatient", "administreLe" DESC);
CREATE INDEX IF NOT EXISTS "vaccinations_dateProchaineD_idx" ON "vaccinations"("dateProchaineD");

-- RendezVous: filtered by patient, ASC, reminder job
CREATE INDEX IF NOT EXISTS "rendez_vous_idPatient_idx" ON "rendez_vous"("idPatient");
CREATE INDEX IF NOT EXISTS "rendez_vous_idAsc_idx" ON "rendez_vous"("idAsc");
CREATE INDEX IF NOT EXISTS "rendez_vous_prevuLe_statut_rappel24h_idx" ON "rendez_vous"("prevuLe", "statut", "rappel24h");

-- Referencement: filtered by target structure and status
CREATE INDEX IF NOT EXISTS "referencements_idStructureCible_statut_idx" ON "referencements"("idStructureCible", "statut");
CREATE INDEX IF NOT EXISTS "referencements_creeLe_idx" ON "referencements"("creeLe");

-- Message: filtered by recipient and unread status
CREATE INDEX IF NOT EXISTS "messages_idDestinataire_lu_idx" ON "messages"("idDestinataire", "lu");
CREATE INDEX IF NOT EXISTS "messages_idExpediteur_idx" ON "messages"("idExpediteur");

-- Facture: filtered by patient and status
CREATE INDEX IF NOT EXISTS "factures_idPatient_creeLe_idx" ON "factures"("idPatient", "creeLe" DESC);
CREATE INDEX IF NOT EXISTS "factures_statut_idx" ON "factures"("statut");

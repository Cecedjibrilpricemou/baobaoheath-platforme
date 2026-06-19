import { z } from 'zod';

const optionalEmail = z.string().email().optional().or(z.literal('').transform(() => undefined));
const phone = z.string().trim().min(6).max(30);
const id = z.string().trim().min(1);
const positiveInt = z.coerce.number().int().positive();
const nonNegativeInt = z.coerce.number().int().min(0);

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const registerSchema = z.object({
  telephone: phone,
  email: optionalEmail,
  motDePasse: z.string().min(6).max(128),
  prenom: z.string().trim().min(1).max(80),
  nom: z.string().trim().min(1).max(80),
}).strict();

export const loginSchema = z.object({
  identifiant: z.string().trim().min(3).max(120),
  motDePasse: z.string().min(1).max(128),
}).strict();

export const verifyLoginOtpSchema = z.object({
  email: z.string().trim().email(),
  code: z.string().trim().regex(/^\d{6}$/, 'Le code OTP doit contenir 6 chiffres'),
}).strict();

export const refreshSchema = z.object({
  refreshToken: z.string().min(10).optional(),
}).strict();

export const changePasswordSchema = z.object({
  ancienMotDePasse: z.string().min(1).max(128).optional(),
  nouveauMotDePasse: z.string().min(6).max(128),
}).strict();

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email(),
}).strict();

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(64).max(64),
  nouveauMotDePasse: z.string().min(6).max(128),
}).strict();

export const updateProfileSchema = z.object({
  prenom: z.string().trim().min(1).max(80).optional(),
  nom: z.string().trim().min(1).max(80).optional(),
  email: optionalEmail,
  telephone: phone.optional(),
}).strict();

export const createPatientSchema = z.object({
  telephone: phone,
  motDePasse: z.string().min(6).max(128),
  prenom: z.string().trim().min(1).max(80),
  nom: z.string().trim().min(1).max(80),
  dateNaissance: z.string().refine((value) => !Number.isNaN(Date.parse(value)), 'Date invalide'),
  sexe: z.string().trim().min(1).max(20),
  prefecture: z.string().trim().min(1).max(80),
  sousPrefecture: z.string().trim().max(80).optional(),
  village: z.string().trim().max(120).optional(),
  groupeSanguin: z.string().trim().max(5).optional(),
  allergies: z.array(z.string().trim().min(1).max(80)).optional(),
  maladiesChroniques: z.array(z.string().trim().min(1).max(80)).optional(),
  urgenceNom: z.string().trim().max(120).optional(),
  urgenceTelephone: phone.optional(),
}).strict();

export const updatePatientSchema = createPatientSchema
  .omit({ telephone: true, motDePasse: true, dateNaissance: true, sexe: true, prefecture: true })
  .extend({
    langue: z.string().trim().min(2).max(10).optional(),
    photoUrl: z.string().url().optional(),
  })
  .partial()
  .strict();

export const updateStructurePrefereeSchema = z.object({
  idStructure: id.nullable().optional(),
}).strict();

export const roleAgentStructureSchema = z.enum(['ASC', 'ASC_SUPERVISOR', 'MEDECIN', 'PHARMACIEN']);

export const createAgentStructureSchema = z.object({
  telephone: phone,
  email: optionalEmail,
  motDePasse: z.string().min(6).max(128).optional(),
  prenom: z.string().trim().min(1).max(80),
  nom: z.string().trim().min(1).max(80),
  role: roleAgentStructureSchema,
}).strict();

export const createStructureSchema = z.object({
  nom: z.string().trim().min(2).max(160),
  type: z.enum(['POSTE', 'CENTRE', 'HOPITAL_PREF', 'HOPITAL_REG', 'CHU', 'CLINIQUE']),
  prefecture: z.string().trim().min(1).max(80),
  adresse: z.string().trim().max(200).optional(),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
  telephone: phone.optional(),
  admin: z.object({
    prenom: z.string().trim().min(1).max(80),
    nom: z.string().trim().min(1).max(80),
    telephone: phone,
    email: optionalEmail,
  }).strict(),
}).strict();

export const createPharmacieSchema = z.object({
  nom: z.string().trim().min(2).max(160),
  prefecture: z.string().trim().min(1).max(80),
  adresse: z.string().trim().max(200).optional(),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
  telephone: phone.optional(),
  pharmacien: z.object({
    prenom: z.string().trim().min(1).max(80),
    nom: z.string().trim().min(1).max(80),
    telephone: phone,
    email: optionalEmail,
    motDePasse: z.string().min(6).max(128).optional(),
  }).strict(),
}).strict();

export const updateStructureSchema = createStructureSchema
  .omit({ admin: true })
  .partial()
  .extend({ estActive: z.boolean().optional() })
  .strict();

export const createAgentPharmacieSchema = z.object({
  telephone: phone,
  email: optionalEmail,
  motDePasse: z.string().min(6).max(128).optional(),
  prenom: z.string().trim().min(1).max(80),
  nom: z.string().trim().min(1).max(80),
}).strict();

export const reapprovisionnerStockSchema = z.object({
  idMedicament: id,
  quantiteAjoutee: positiveInt,
  unite: z.string().trim().min(1).max(40).optional(),
  datePeremption: z.string().refine((value) => !Number.isNaN(Date.parse(value)), 'Date invalide').optional(),
  margeGnf: nonNegativeInt.optional(),
}).strict();

export const delivrerOrdonnanceSchema = z.object({
  modePaiement: z.enum(['ESPECES', 'ORANGE_MONEY', 'MTN_MOMO']).optional(),
  quantiteDelivree: z.coerce.number().int().positive().optional(),
}).strict();

export const createConsultationSchema = z.object({
  idPatient: id,
  motifPrincipal: z.string().trim().min(2).max(500),
  symptomes: z.array(z.string().trim().min(1).max(120)).optional(),
}).strict();

export const updateConsultationSchema = z.object({
  motifPrincipal: z.string().trim().min(2).max(500).optional(),
  symptomes: z.array(z.string().trim().min(1).max(120)).optional(),
  notesAsc: z.string().trim().max(2000).optional(),
  protocoleUtilise: z.string().trim().max(200).optional(),
  confianceIa: z.coerce.number().min(0).max(1).optional(),
}).strict();

export const vitalsSchema = z.object({
  temperature: z.coerce.number().min(20).max(45).optional(),
  poidsKg: z.coerce.number().positive().max(300).optional(),
  tailleCm: z.coerce.number().positive().max(250).optional(),
  perimetreBrachial: z.coerce.number().positive().max(80).optional(),
  tensionSystolique: z.coerce.number().int().positive().max(300).optional(),
  tensionDiastolique: z.coerce.number().int().positive().max(200).optional(),
  frequenceCardiaque: z.coerce.number().int().positive().max(250).optional(),
  frequenceRespiratoire: z.coerce.number().int().positive().max(120).optional(),
  spo2: z.coerce.number().min(0).max(100).optional(),
  glycemie: z.coerce.number().positive().max(50).optional(),
}).strict();

export const diagnosticSchema = z.object({
  libelle: z.string().trim().min(2).max(200),
  codeIcd11: z.string().trim().max(50).optional(),
  typeDiagnostic: z.enum(['PRINCIPAL', 'DIFFERENTIEL', 'SECONDAIRE']).optional(),
  severite: z.enum(['LEGER', 'MODERE', 'SEVERE', 'CRITIQUE']).optional(),
  source: z.enum(['IA_LOCALE', 'IA_CLAUDE', 'MEDECIN', 'ASC']),
}).strict();

export const ordonnanceSchema = z.object({
  idMedicament: id,
  posologie: z.string().trim().min(1).max(300),
  frequence: z.string().trim().min(1).max(120),
  dureeJours: positiveInt.max(365),
  quantite: positiveInt.max(10000).optional(),
  instructions: z.string().trim().max(500).optional(),
}).strict();

export const referralSchema = z.object({
  idStructureCible: id,
  urgence: z.enum(['ROUTINE', 'URGENT', 'URGENCE_VITALE']),
  resumeClinique: z.string().trim().min(10).max(3000),
}).strict();

export const initierPaiementSchema = z.object({
  idConsultation: id,
  montantGnf: positiveInt.max(10_000_000),
  modePaiement: z.enum(['ORANGE_MONEY', 'MTN_MOMO', 'ESPECES']),
  numeroOperateur: z.string().trim().min(6).max(30).optional(),
}).strict();

export const confirmerPaiementSchema = z.object({
  referenceOperateur: z.string().trim().min(3).max(120),
}).strict();

export const syncChangesQuerySchema = z.object({
  since: z.string().refine((value) => !Number.isNaN(Date.parse(value)), 'Date invalide').optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
  scope: z.string().trim().min(1).max(80).optional(),
}).strict();

const syncOperationSchema = z.enum(['CREATE', 'UPDATE', 'DELETE']);

export const syncPushSchema = z.object({
  mutations: z.array(z.object({
    clientMutationId: z.string().trim().min(8).max(120),
    deviceId: z.string().trim().min(2).max(120).optional(),
    entityType: z.string().trim().min(2).max(80),
    entityId: z.string().trim().min(1).max(120).optional(),
    operation: syncOperationSchema,
    payload: z.record(z.string(), z.unknown()),
    baseVersion: z.coerce.number().int().positive().optional(),
  }).strict()).min(1).max(100),
}).strict();

export const triageSchema = z.object({
  ageAnnees: z.coerce.number().int().min(0).max(130).optional(),
  symptomes: z.array(z.string().trim().min(1).max(120)).min(1).max(40),
  constantes: z.object({
    temperature: z.coerce.number().min(20).max(45).optional(),
    spo2: z.coerce.number().min(0).max(100).optional(),
    frequenceRespiratoire: z.coerce.number().int().positive().max(120).optional(),
    frequenceCardiaque: z.coerce.number().int().positive().max(250).optional(),
    tensionSystolique: z.coerce.number().int().positive().max(300).optional(),
    glycemie: z.coerce.number().positive().max(50).optional(),
  }).strict().optional(),
}).strict();

export const consentSchema = z.object({
  scope: z.enum(['DOSSIER_MEDICAL', 'FHIR_EXPORT', 'RAPPELS_SMS', 'RECHERCHE_ANONYMISEE']),
  actif: z.boolean(),
  source: z.string().trim().min(2).max(40).optional(),
  commentaire: z.string().trim().max(500).optional(),
}).strict();

export const ussdSessionSchema = z.object({
  sessionId: z.string().trim().min(3).max(120),
  phoneNumber: phone,
  text: z.string().max(500).optional().default(''),
}).strict();

export const createVaccinationSchema = z.object({
  idPatient: id,
  vaccinNom: z.string().trim().min(2).max(120),
  codeEpi: z.string().trim().max(40).optional(),
  numeroLot: z.string().trim().max(80).optional(),
  siteInjection: z.string().trim().max(120).optional(),
  reaction: z.string().trim().max(500).optional(),
  dateProchaineD: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Date invalide').optional(),
}).strict();

export const updateVaccinationSchema = z.object({
  reaction: z.string().trim().max(500).optional(),
  urlCertificat: z.string().url().optional(),
  dateProchaineD: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Date invalide').optional(),
}).strict();

export const updateAscProfileSchema = z.object({
  bio: z.string().trim().max(500).optional(),
  photoUrl: z.string().url().optional(),
  telephone: phone.optional(),
}).strict();

export const createAscStockSchema = z.object({
  idMedicament: id,
  quantite: nonNegativeInt,
  unite: z.string().trim().min(1).max(40).optional(),
  seuilAlerte: nonNegativeInt.optional(),
  datePeremption: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Date invalide').optional(),
}).strict();

export const updateAscStockSchema = z.object({
  quantite: nonNegativeInt.optional(),
  seuilAlerte: nonNegativeInt.optional(),
  datePeremption: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Date invalide').optional(),
}).strict();

export const sendSmsSchema = z.object({
  telephone: phone,
  message: z.string().trim().min(1).max(480),
}).strict();

export const sendSmsMasseSchema = z.object({
  prefecture: z.string().trim().min(1).max(80),
  message: z.string().trim().min(1).max(480),
}).strict();

export const validerConsultationSchema = z.object({
  notesMedecin: z.string().trim().max(3000).optional(),
  tarifGnf: z.coerce.number().int().min(0).max(10_000_000).optional(),
}).strict();

export const repondreReferencementSchema = z.object({
  statut: z.enum(['ACCEPTE', 'REFUSE', 'COMPLETE']),
  commentaire: z.string().trim().max(1000).optional(),
}).strict();

export const sendMessageSchema = z.object({
  contenu: z.string().trim().min(1).max(2000),
  idDestinataire: id,
}).strict();

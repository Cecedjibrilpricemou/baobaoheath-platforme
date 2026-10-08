import { z } from 'zod';
import {
  ConsentScope, MotifBrisDeGlace, NiveauIdentite, Role, StatutDemandeRgpd, TypeDemandeRgpd, TypePieceIdentite,
} from '../config/generated/client/client';

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
  photoUrl: z.string().trim().url().max(500).optional(),
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

/**
 * Liberation des resultats au patient (addendum du 2026-09-28). Le commentaire
 * est facultatif : un bilan sans particularite n'appelle pas d'explication, et
 * en exiger une produirait des « RAS » systematiques qui n'apprennent rien.
 */
/**
 * Le medecin fixe le creneau (addendum du 2026-09-28, point 3). L'accueil ne
 * propose plus d'heure : `orientationSchema` a perdu son `prevuLe`.
 */
/**
 * Prise de rendez-vous a distance (addendum du 2026-09-28, point 6). Le motif
 * est libre : c'est le patient qui l'ecrit, avec ses mots.
 */
/**
 * Facture d'approvisionnement (addendum du 2026-09-28, point 1.3). Chaque
 * ligne devient un lot : c'est la que la date de peremption se pose, et non
 * plus sur le stock.
 */
export const creerApprovisionnementSchema = z.object({
  fournisseur: z.string().trim().min(2).max(200),
  dateFacture: z.string().min(1),
  numeroFacture: z.string().trim().max(100).optional(),
  justificatifUrl: z.string().trim().max(500).optional(),
  lignes: z.array(z.object({
    idMedicament: id,
    quantite: positiveInt.max(100000),
    numeroLot: z.string().trim().max(100).optional(),
    datePeremption: z.string().optional(),
    prixAchatGnf: nonNegativeInt.optional(),
    unite: z.string().trim().max(40).optional(),
  })).min(1).max(200),
}).strict();

// ── Vente au comptoir (addendum, point 1.1) ──────────────────────────
//
// La remise n'est pas plafonnee ici : le plafond est un parametre
// administrable (`pharmacie.remiseMaxPourcent`), donc la regle vit dans le
// service. Ce schema ne verifie que la forme.
export const creerVenteSchema = z.object({
  lignes: z.array(z.object({
    idMedicament: id,
    quantite: positiveInt.max(10000),
  })).min(1).max(100),
  modePaiement: z.enum(['ESPECES', 'ORANGE_MONEY', 'MTN_MOMO']),
  numeroOperateur: z.string().trim().max(40).optional(),
  remiseGnf: nonNegativeInt.optional(),
  idPatient: id.optional(),
  idOrdonnance: id.optional(),
  // Tiers payant (EF-09). Le schema etant `.strict()`, oublier ce champ ici
  // fait rejeter la requete en 400 alors que le contrat et le service le
  // portent. C'est arrive le 2026-10-02, et seul le controle contre la vraie
  // API l'a vu : les tests unitaires appellent le service, pas Zod.
  avecAssurance: z.boolean().optional(),
}).strict();

export const annulerVenteSchema = z.object({
  motif: z.string().trim().min(5).max(500),
}).strict();

export const creerDemandeRendezVousSchema = z.object({
  motif: z.string().trim().min(5).max(1000),
  idStructure: id.optional(),
  idMedecin: id.optional(),
}).strict();

export const accepterDemandeRendezVousSchema = z.object({
  prevuLe: z.string().min(1),
}).strict();

/** Un refus sans explication est un mur : le motif est obligatoire. */
export const refuserDemandeRendezVousSchema = z.object({
  motif: z.string().trim().min(5).max(500),
}).strict();

export const orienterDemandeRendezVousSchema = z.object({
  idMedecin: id,
}).strict();

export const fixerRendezVousSchema = z.object({
  prevuLe: z.string().min(1),
  motif: z.string().trim().max(500).optional(),
});

export const statutRendezVousSchema = z.object({
  statut: z.enum(['EN_CONSULTATION', 'TERMINE', 'ABSENT']),
});

export const libererResultatsSchema = z.object({
  commentaire: z.string().trim().max(2000).optional(),
});

export const roleAgentStructureSchema = z.enum(['ASC', 'ASC_SUPERVISOR', 'MEDECIN', 'PHARMACIEN', 'AGENT_ACCUEIL', 'TECHNICIEN_LABO']);

export const createAgentStructureSchema = z.object({
  telephone: phone,
  email: optionalEmail,
  motDePasse: z.string().min(6).max(128).optional(),
  prenom: z.string().trim().min(1).max(80),
  nom: z.string().trim().min(1).max(80),
  role: roleAgentStructureSchema,
  // Ou le patient devra se rendre. **Facultatif** : beaucoup d'hopitaux ne
  // numerotent pas leurs bureaux, et l'agent accompagne a pied. Ignore pour
  // les roles autres que MEDECIN.
  bureau: z.string().trim().min(1).max(120).optional(),
}).strict();

// --- Creation d'un patient au comptoir (EF-03-01) -------------------
//
// Pas de mot de passe : il est genere et remis au patient. Pas d'antecedents
// non plus — au comptoir on enregistre une identite, le reste se recueille en
// consultation.
export const creerPatientComptoirSchema = z.object({
  telephone: phone,
  prenom: z.string().trim().min(1).max(80),
  nom: z.string().trim().min(1).max(80),
  dateNaissance: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Date invalide'),
  sexe: z.enum(['M', 'F']),
  prefecture: z.string().trim().min(1).max(80),
  sousPrefecture: z.string().trim().max(80).optional(),
  email: optionalEmail,
}).strict();

// --- Le compte par lequel un assureur se connecte (addendum, point 5.2) ---
export const creerAgentAssureurSchema = z.object({
  prenom: z.string().trim().min(1).max(80),
  nom: z.string().trim().min(1).max(80),
  telephone: phone,
  email: optionalEmail,
  prefecture: z.string().trim().max(80).optional(),
}).strict();

// --- Un versement de la compagnie a une officine (addendum, point 5.2) ---
//
// Pas d'`idAssureur` : il se deduit de la structure de l'agent connecte.
// L'accepter en entree laisserait un agent regler au nom d'un concurrent.
export const creerReglementSchema = z.object({
  idStructure: z.string().min(1, 'Choisissez une pharmacie'),
  montantGnf: z.number().int().positive('Le montant verse doit etre positif'),
  periodeDebut: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Date invalide'),
  periodeFin: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Date invalide'),
  reference: z.string().trim().max(120).optional(),
}).strict().refine((d) => new Date(d.periodeFin) >= new Date(d.periodeDebut), {
  message: 'La fin de periode precede son debut',
  path: ['periodeFin'],
});

/** Un bureau change : un medecin demenage, un service est redecoupe. */
export const definirBureauSchema = z.object({
  bureau: z.string().trim().min(1).max(120).nullable(),
}).strict();

export const createStructureSchema = z.object({
  nom: z.string().trim().min(2).max(160),
  type: z.enum(['POSTE', 'CENTRE', 'HOPITAL_PREF', 'HOPITAL_REG', 'CHU', 'CLINIQUE', 'LABORATOIRE']),
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

// EF-07-01. Le service compare en majuscules : la casse saisie au comptoir ne
// doit pas faire echouer un controle legitime.
export const verifierOrdonnanceSchema = z.object({
  numero: z.string().trim().regex(/^OR-\d{4}-\d{6}$/i, 'Numero d ordonnance invalide'),
  codeVerification: z.string().trim().min(4).max(12),
}).strict();

// EF-05-05 : demande d'analyse des alertes avant prescription.
export const alertesPrescriptionSchema = z.object({
  idMedicament: id,
}).strict();

// ── P6 : commande pharmacie (EF-07) ──────────────────────────────────
export const lancerRechercheSchema = z.object({ idOrdonnance: id }).strict();

export const repondreDisponibiliteSchema = z.object({
  // Une pharmacie repond oui ou non : il n'y a pas de « peut-etre ». La
  // reponse partielle se traite par la delivrance ligne a ligne, plus tard.
  aTousLesProduits: z.boolean(),
}).strict();

export const retirerPriseEnChargeSchema = z.object({
  // Le patient attend une explication, pas un desistement muet.
  motif: z.string().trim().min(5).max(300),
}).strict();

export const choisirModeRemiseSchema = z.object({
  mode: z.enum(['RETRAIT_PHARMACIE', 'LIVRAISON']),
}).strict();

export const createConsultationSchema = z.object({
  idPatient: id,
  motifPrincipal: z.string().trim().min(2).max(500),
  symptomes: z.array(z.string().trim().min(1).max(120)).optional(),
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
  // EF-05-06 : pourquoi le prescripteur passe outre une alerte. Une longueur
  // minimale evite le « ok » qui ne documente rien.
  motifDepassement: z.string().trim().min(5).max(500).optional(),
  // EF-05-09 : le plafond reel vient du parametre systeme ; ici on borne
  // seulement pour ne pas accepter n'importe quel entier.
  renouvellementsAutorises: z.coerce.number().int().min(0).max(24).optional(),
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

// `motifRefus` : nom du champ dans RepondreReferencementDto (shared-types) et
// dans medecin.service ; le schema strict rejetait la cle sous l'ancien nom.
export const repondreReferencementSchema = z.object({
  statut: z.enum(['ACCEPTE', 'REFUSE', 'COMPLETE']),
  motifRefus: z.string().trim().max(1000).optional(),
}).strict();

export const sendMessageSchema = z.object({
  contenu: z.string().trim().min(1).max(2000),
  idDestinataire: id,
}).strict();

// ─── Parametres systeme (super-admin) ────────────────────────────────────────
// Bornes alignees sur les curseurs de la page Parametres du web.
const texteCourt = z.string().trim().max(120);
const emailOuVide = z.string().trim().max(160).refine((v) => v === '' || z.string().email().safeParse(v).success, 'Adresse e-mail invalide');
const urlOuVide = z.string().trim().max(300).refine((v) => v === '' || /^https?:\/\/\S+$/i.test(v), 'URL invalide (http:// ou https://)');
const telephoneOuVide = z.string().trim().max(30).refine((v) => v === '' || /^[+0-9 ().-]{6,30}$/.test(v), 'Numéro de téléphone invalide');

export const updateParametresSystemeSchema = z.object({
  identite: z.object({
    nom: z.string().trim().min(2).max(60),
    nomCourt: z.string().trim().max(20).regex(/^[A-Za-z0-9 .-]*$/, 'Lettres non accentuées et chiffres uniquement (SMS)'),
    slogan: texteCourt,
    logoUrl: urlOuVide,
    adresse: z.string().trim().max(200),
    ville: texteCourt,
    pays: texteCourt,
    telephone: telephoneOuVide,
    telephoneSupport: telephoneOuVide,
    emailContact: emailOuVide,
    emailSupport: emailOuVide,
    emailExpediteur: z.string().trim().max(60),
    siteWeb: urlOuVide,
    facebook: urlOuVide,
    whatsapp: telephoneOuVide,
    copyright: texteCourt,
    devise: z.string().trim().length(3).toUpperCase(),
  }).partial().strict().optional(),
  facturation: z.object({
    paiementEspeces: z.boolean(),
    paiementOrangeMoney: z.boolean(),
    paiementMomo: z.boolean(),
    margePct: z.coerce.number().int().min(0).max(50),
  }).partial().strict().optional(),
  securite: z.object({
    consentementDefaut: z.boolean(),
  }).partial().strict().optional(),
  alertes: z.object({
    seuilPaludisme: z.coerce.number().int().min(1).max(500),
    seuilEbola: z.coerce.number().int().min(1).max(50),
    activerIA: z.boolean(),
  }).partial().strict().optional(),
  sync: z.object({
    offlineMode: z.boolean(),
    frequenceMinutes: z.coerce.number().int().min(1).max(1440),
    ussdTimeoutSecondes: z.coerce.number().int().min(30).max(3600),
  }).partial().strict().optional(),

  // Ces deux sections manquaient. Le schema etant `.strict()`, l'onglet
  // « Ordonnances » de l'ecran d'administration envoyait un corps rejete en
  // 400 : il s'affichait, son bouton repondait, et rien ne s'enregistrait.
  // Constate le 2026-10-02 en ajoutant la section « pharmacie ».
  prescription: z.object({
    dureeValiditeJours: z.coerce.number().int().min(1).max(365),
    longueurCodeVerification: z.coerce.number().int().min(4).max(12),
    signatureObligatoire: z.boolean(),
    dureeValiditeReglementeJours: z.coerce.number().int().min(1).max(365),
    renouvellementsMax: z.coerce.number().int().min(0).max(24),
  }).partial().strict().optional(),

  pharmacie: z.object({
    remiseMaxPourcent: z.coerce.number().int().min(0).max(100),
    categoriesExigeantOrdonnance: z.array(z.enum([
      'MEDICAMENT', 'LAIT_INFANTILE', 'COMPLEMENT_ALIMENTAIRE', 'COSMETIQUE',
      'HYGIENE', 'PARAPHARMACIE', 'DISPOSITIF_MEDICAL', 'AUTRE',
    ])).max(8),
  }).partial().strict().optional(),
}).strict();

// ─── P1 Hopital : episodes de soins et demandes d'analyse (EF-03) ────────────
const texteLibre = (max: number) => z.string().trim().max(max);

export const createEpisodeSchema = z.object({
  idPatient: id,
  motif: z.string().trim().min(3).max(300),
  service: texteLibre(120).optional(),
  idResponsable: id.optional(),
  notes: texteLibre(2000).optional(),
}).strict();

export const updateEpisodeSchema = z.object({
  motif: z.string().trim().min(3).max(300).optional(),
  service: texteLibre(120).optional(),
  idResponsable: id.nullable().optional(),
  notes: texteLibre(2000).nullable().optional(),
  statut: z.enum(['OUVERT', 'EN_COURS']).optional(),
}).strict();

// `prevuLe` a ete retire le 2026-09-30 : l'accueil oriente, le medecin fixe
// le creneau (addendum, point 3). `.strict()` fait donc echouer un ancien
// appel qui enverrait encore une date, plutot que de l'ignorer en silence.
export const orientationSchema = z.object({
  service: texteLibre(120).optional(),
  idMedecin: id.optional(),
  motif: texteLibre(300).optional(),
}).strict().refine((v) => v.idMedecin || v.service, { message: 'Indiquez un medecin ou un service' });

export const createDemandeAnalyseSchema = z.object({
  idLaboratoire: id,
  urgence: z.enum(['ROUTINE', 'URGENT', 'URGENCE_VITALE']).optional(),
  indicationClinique: texteLibre(1000).optional(),
  consignesPatient: texteLibre(1000).optional(),
  examens: z.array(z.object({ idExamen: id, commentaire: texteLibre(300).optional() }).strict()).min(1).max(40),
}).strict();

export const annulerDemandeSchema = z.object({
  motif: z.string().trim().min(3).max(300),
}).strict();

export const episodesQuerySchema = paginationQuerySchema.extend({
  statut: z.enum(['OUVERT', 'EN_COURS', 'CLOS', 'ANNULE']).optional(),
  q: z.string().trim().max(100).optional(),
});

// ── P2 — Laboratoire (EF-04) ─────────────────────────────────────────
const lieuPrelevement = z.enum(['SUR_PLACE', 'DOMICILE']);

export const fileLaboQuerySchema = paginationQuerySchema.extend({
  statut: z.enum(['TRANSMISE', 'RECUE', 'PRELEVEE', 'EN_ANALYSE', 'VALIDEE', 'ANNULEE']).optional(),
  q: z.string().trim().max(100).optional(),
});

export const planifierPrelevementSchema = z.object({
  lieu: lieuPrelevement,
  creneau: z.string().datetime({ offset: true }).optional(),
}).strict();

export const enregistrerPrelevementSchema = z.object({
  echantillons: z.array(z.object({ specimen: z.string().trim().min(2).max(40), commentaire: texteLibre(300).optional() }).strict()).max(20).optional(),
  lieu: lieuPrelevement.optional(),
}).strict();

export const saisirResultatsSchema = z.object({
  resultats: z.array(z.object({
    idLigne: id.optional(),
    codeLoinc: z.string().trim().min(1).max(20).optional(),
    valeur: z.string().trim().min(1).max(200),
    unite: z.string().trim().max(30).optional(),
    commentaire: texteLibre(500).optional(),
    idEchantillon: id.optional(),
    interpretation: z.enum(['NORMAL', 'ANORMAL', 'CRITIQUE']).optional(),
  }).strict().refine((r) => r.idLigne || r.codeLoinc, { message: 'Indiquez idLigne ou codeLoinc' })).min(1).max(100),
}).strict();

export const validerResultatsSchema = z.object({
  commentaire: texteLibre(2000).optional(),
}).strict();

export const evolutionQuerySchema = z.object({
  codeLoinc: z.string().trim().min(1).max(20),
  idPatient: id.optional(),
});

export const notificationsQuerySchema = paginationQuerySchema.extend({
  lu: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
});

// ── Assurance et tiers payant (EF-09, addendum point 5) ──────────────

const categorieProduit = z.enum([
  'MEDICAMENT', 'LAIT_INFANTILE', 'COMPLEMENT_ALIMENTAIRE', 'COSMETIQUE',
  'HYGIENE', 'PARAPHARMACIE', 'DISPOSITIF_MEDICAL', 'AUTRE',
]);

export const verifierEligibiliteSchema = z.object({
  idPatient: id,
}).strict();

export const simulerPriseEnChargeSchema = z.object({
  idPatient: id,
  lignes: z.array(z.object({
    idMedicament: id,
    libelle: z.string().trim().min(1).max(200),
    categorie: categorieProduit,
    montantGnf: nonNegativeInt.max(1_000_000_000),
  })).min(1).max(100),
  montantNetGnf: nonNegativeInt.max(1_000_000_000),
}).strict();

export const creerAssureurSchema = z.object({
  nom: z.string().trim().min(2).max(120),
  // Le code figure sur la carte de l'assure : court, sans espace, lisible.
  code: z.string().trim().min(2).max(16).regex(/^[A-Za-z0-9-]+$/, 'Lettres, chiffres et tirets uniquement'),
  telephone: z.string().trim().max(40).optional(),
  email: z.string().trim().email().max(120).optional(),
  modeEchange: z.enum(['MANUEL', 'PORTAIL', 'API']).optional(),
  idStructure: id.optional(),
}).strict();

// `exclu` et `tauxPourcent` ensemble seraient contradictoires ; le service le
// refuse, et une contrainte SQL le refuse aussi.
export const creerRegleCouvertureSchema = z.object({
  categorie: categorieProduit,
  exclu: z.boolean().optional(),
  tauxPourcent: z.coerce.number().int().min(0).max(100).optional(),
  plafondLigneGnf: nonNegativeInt.max(1_000_000_000).optional(),
  dateEffet: z.string().optional(),
}).strict();

export const creerContratAssuranceSchema = z.object({
  idAssureur: id,
  idPatient: id,
  numeroPolice: z.string().trim().min(2).max(60),
  tauxBasePourcent: z.coerce.number().int().min(0).max(100).optional(),
  plafondAnnuelGnf: nonNegativeInt.max(1_000_000_000).optional(),
  franchiseGnf: nonNegativeInt.max(1_000_000_000).optional(),
  dateEffet: z.string().min(1),
  dateFin: z.string().optional(),
  carenceJours: z.coerce.number().int().min(0).max(365).optional(),
}).strict();

// ── Referentiels importables (EF-12-03) ──────────────────────────────
//
// Le contenu est un CSV entier : la borne haute est volontairement large
// (2 Mo), un referentiel national comptant des milliers de lignes. Au-dela,
// c'est un envoi de fichier qu'il faudra, pas un corps JSON.
// --- Journal d audit : recherche et export (EF-12-05) ---------------
//
// Les criteres arrivent en chaine de requete. Le schema reste `.strict()` :
// un critere mal orthographe doit se voir, pas s ignorer en silence et rendre
// un resultat trop large a une enquete.
//
// La liste des roles vient de l enumere Prisma plutot que d une copie : une
// copie se serait desynchronisee au premier role ajoute, et le filtre aurait
// refuse un role parfaitement valide.
//
// Il s applique a `req.query` via `validateQuery`, donc **toutes les valeurs
// arrivent en chaines** : les booleens sont lus depuis « true »/« false » et
// les nombres sont convertis. Une premiere version recopiait les criteres a
// la main dans le routeur, ce qui ecartait les cles inconnues avant que Zod
// ne les voie : `.strict()` ne servait a rien, et `echecSeulement` mal
// orthographie passait en silence avec un resultat trop large. Verifie contre
// l API reelle.
const booleenDeRequete = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true')
  .optional();

// --- Identito-vigilance (EF-01-04/10) -------------------------------
//
// Le numero de piece et le lieu de naissance sont exiges : ce sont eux que la
// contrainte SQL reclame pour une identite verifiee. Les redire ici permet de
// refuser tot, avec un message utile, plutot que de laisser remonter une
// violation de contrainte.
export const verifierIdentiteSchema = z.object({
  typePiece: z.nativeEnum(TypePieceIdentite),
  numeroPiece: z.string().trim().min(3).max(60),
  lieuNaissance: z.string().trim().min(2).max(120),
  nomMere: z.string().trim().min(2).max(120).optional(),
  remplacerPiece: z.boolean().optional(),
}).strict();

export const noterTraitsSchema = z.object({
  lieuNaissance: z.string().trim().min(2).max(120).optional(),
  nomMere: z.string().trim().min(2).max(120).optional(),
}).strict();

export const filtreIdentitesSchema = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  niveau: z.nativeEnum(NiveauIdentite).optional(),
}).strict();

// --- Numero d'ordre professionnel (EF-01-08) ------------------------
export const verifierOrdreSchema = z.object({
  numeroOrdre: z.string().trim().min(3, {
    message: "Saisissez le numero tel qu'il figure au registre de l'ordre.",
  }).max(60),
}).strict();

// --- Bris de glace (EF-02-06) ---------------------------------------
//
// Les bornes sont celles de la base (`bris_de_glace_*`). Le message est en
// francais et dit quoi faire : celui qui le lit a souvent un patient devant
// lui.
const EXPLICATION_BRIS =
  "Expliquez la situation en une phrase : c'est elle qui sera relue, et c'est elle qui vous protège.";

export const declarerBrisDeGlaceSchema = z.object({
  idPatient: z.string().trim().min(1, { message: 'Indiquez le dossier concerne.' }),
  motif: z.nativeEnum(MotifBrisDeGlace),
  explication: z.string().trim().min(20, { message: EXPLICATION_BRIS }).max(2000),
}).strict();

export const reviserBrisDeGlaceSchema = z.object({
  statut: z.enum(['JUSTIFIE', 'INJUSTIFIE']),
  avis: z.string().trim().min(20, {
    message: "Dites en une phrase pourquoi l'accès était fondé ou ne l'était pas.",
  }).max(2000),
}).strict();

export const filtreBrisDeGlaceSchema = z.object({
  idPatient: z.string().trim().min(1).optional(),
  aRevoirSeulement: z.enum(['true', 'false']).optional(),
}).strict();

// --- Textes de consentement (EF-02-01) ------------------------------
//
// Les bornes sont les memes qu'en base (`textes_consentement_*`) : refuser
// tot, avec un message utile, plutot que de laisser remonter une violation de
// contrainte. Un texte qui n'explique rien ne recueille pas un consentement
// eclaire — d'ou les 40 caracteres.
export const publierTexteConsentementSchema = z.object({
  scope: z.nativeEnum(ConsentScope),
  langue: z.string().trim().regex(/^[a-z]{2}$/, {
    message: 'La langue est un code de deux lettres minuscules : fr, en, pu, ml.',
  }),
  titre: z.string().trim().min(3).max(200),
  corps: z.string().trim().min(40, {
    message: "Le texte doit dire a quoi la personne s'engage : quarante caracteres au moins.",
  }).max(20000),
}).strict();

export const filtreTextesConsentementSchema = z.object({
  scope: z.nativeEnum(ConsentScope).optional(),
}).strict();

// --- Fusion de dossiers patients (EF-01-06) -------------------------
//
// Le motif est exige et sa longueur minimale est la meme qu'en base
// (`fusions_dossier_motif_dit_quelque_chose`) : le schema refuse tot, avec un
// message utile, plutot que de laisser remonter une violation de contrainte.
//
// **Le message est en francais et dit quoi faire.** Sans lui, Zod repondait
// « Too small: expected string to have >=10 characters » — l'agent lisait de
// l'anglais technique, et la phrase ecrite pour lui dans le service n'etait
// jamais atteinte, puisque la validation refuse avant. Vu en appelant la vraie
// route le 2026-10-04.
const MOTIF_FUSION =
  "Dites en une phrase sur quoi vous vous fondez : c'est ce qui permettra de contester la fusion plus tard.";

export const fusionnerSchema = z.object({
  idAbsorbe: z.string().trim().min(1, { message: 'Indiquez le dossier a absorber.' }),
  motif: z.string().trim().min(10, { message: MOTIF_FUSION }).max(2000),
}).strict();

export const annulerFusionSchema = z.object({
  motifAnnulation: z.string().trim().min(10, {
    message: "Dites en une phrase pourquoi cette fusion est annulee : c'est ce qui restera au dossier.",
  }).max(2000),
}).strict();

// --- Demandes d exercice de droits (EF-12-09) -----------------------
//
// La precision est obligatoire pour une rectification : sans elle, on ne sait
// pas quoi corriger. Le service le verifie aussi, parce qu un schema ne peut
// pas exprimer cette dependance sans devenir illisible.
export const deposerDemandeRgpdSchema = z.object({
  type: z.nativeEnum(TypeDemandeRgpd),
  precision: z.string().trim().min(1).max(2000).optional(),
}).strict();

// La reponse fait au moins dix caracteres : un refus qu on ne motive pas n est
// pas contestable. La meme regle vit dans le service et dans une contrainte
// SQL, pour qu elle ne depende d aucun des trois seul.
export const repondreDemandeRgpdSchema = z.object({
  satisfaite: z.boolean(),
  reponse: z.string().trim().min(10).max(4000),
}).strict();

export const filtreDemandesRgpdSchema = z.object({
  statut: z.nativeEnum(StatutDemandeRgpd).optional(),
  type: z.nativeEnum(TypeDemandeRgpd).optional(),
}).strict();

// --- Suspension de compte (EF-12-01) --------------------------------
//
// Le motif est long d au moins dix caracteres : « non » ou « rgpd » ne disent
// rien, et une suspension qu on ne peut pas expliquer ne peut pas etre
// contestee. La meme regle vit dans le service et dans une contrainte SQL,
// pour qu elle ne depende d aucune des trois seules.
export const suspendreCompteSchema = z.object({
  motif: z.string().trim().min(10).max(500),
}).strict();

export const filtreComptesSchema = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  role: z.nativeEnum(Role).optional(),
  actifs: booleenDeRequete,
  page: positiveInt.optional(),
  limit: positiveInt.max(100).optional(),
}).strict();

export const filtreJournalSchema = z.object({
  du: z.string().trim().min(1).optional(),
  au: z.string().trim().min(1).optional(),
  idUtilisateur: id.optional(),
  idPatient: id.optional(),
  role: z.nativeEnum(Role).optional(),
  ressource: z.string().trim().min(1).max(60).optional(),
  echecsSeulement: booleenDeRequete,
  parTiers: booleenDeRequete,
  page: positiveInt.optional(),
  limit: positiveInt.max(200).optional(),
}).strict();

export const importerReferentielSchema = z.object({
  contenu: z.string().min(1).max(2_000_000),
  simulation: z.boolean().optional(),
}).strict();

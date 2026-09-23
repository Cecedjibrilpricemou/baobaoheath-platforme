import { Express, Request, Response, NextFunction } from 'express';
import swaggerUi from 'swagger-ui-express';
import { logger } from './logger';
import { getIdentitePlateforme } from '../services/parametres.service';

export const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'API', // complete a la volee avec le nom de la plateforme (Parametres > Identite)
    version: '1.0.0',
    description: 'API de la plateforme de parcours de soins connecté',
    contact: {
      name: 'Équipe technique',
    },
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Serveur de développement',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Token JWT obtenu via /api/v1/auth/login',
      },
    },
    schemas: {
      ApiResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: { type: 'object' },
          error: { type: 'string' },
        },
      },
      RegisterDto: {
        type: 'object',
        required: ['telephone', 'motDePasse', 'prenom', 'nom'],
        properties: {
          telephone: { type: 'string', example: '+224621000000', description: 'Numéro de téléphone guinéen' },
          motDePasse: { type: 'string', example: 'MotDePasse123!', description: 'Minimum 8 caractères' },
          prenom: { type: 'string', example: 'Mamadou' },
          nom: { type: 'string', example: 'Diallo' },
          role: { type: 'string', enum: ['PATIENT', 'ASC', 'ASC_SUPERVISOR', 'MEDECIN', 'PHARMACIEN', 'ADMIN_STRUCTURE', 'ADMIN_REGIONAL', 'ADMIN_NATIONAL', 'SUPER_ADMIN'], default: 'PATIENT' },
        },
      },
      LoginDto: {
        type: 'object',
        required: ['telephone', 'motDePasse'],
        properties: {
          telephone: { type: 'string', example: '+224621000000' },
          motDePasse: { type: 'string', example: 'MotDePasse123!' },
        },
      },
      AuthAck: {
        type: 'object',
        description: "Les tokens ne sont plus renvoyés dans le corps de la réponse : ils sont posés en cookies httpOnly (bb_access, bb_refresh) accompagnés d'un cookie bb_csrf (non httpOnly) à répercuter dans l'en-tête X-CSRF-Token sur toute requête mutante.",
        properties: {
          authenticated: { type: 'boolean', example: true },
        },
      },
      Utilisateur: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          telephone: { type: 'string' },
          email: { type: 'string' },
          prenom: { type: 'string' },
          nom: { type: 'string' },
          role: { type: 'string' },
          langue: { type: 'string' },
          photoUrl: { type: 'string' },
          estActif: { type: 'boolean' },
          creeLe: { type: 'string', format: 'date-time' },
        },
      },
      CreatePatientDto: {
        type: 'object',
        required: ['telephone', 'motDePasse', 'prenom', 'nom', 'dateNaissance', 'sexe', 'prefecture'],
        properties: {
          telephone: { type: 'string', example: '+224621000000' },
          motDePasse: { type: 'string', example: 'MotDePasse123!' },
          prenom: { type: 'string', example: 'Fatoumata' },
          nom: { type: 'string', example: 'Camara' },
          dateNaissance: { type: 'string', format: 'date', example: '1995-06-15' },
          sexe: { type: 'string', enum: ['M', 'F', 'A'], example: 'F' },
          prefecture: { type: 'string', example: 'Conakry' },
          sousPrefecture: { type: 'string', example: 'Matam' },
          village: { type: 'string', example: 'Kipé' },
          groupeSanguin: { type: 'string', example: 'O+' },
          allergies: { type: 'array', items: { type: 'string' }, example: ['Pénicilline'] },
          maladiesChroniques: { type: 'array', items: { type: 'string' }, example: ['Diabète'] },
          urgenceNom: { type: 'string', example: 'Ibrahima Camara' },
          urgenceTelephone: { type: 'string', example: '+224622000000' },
        },
      },
      PatientProfile: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          qrCode: { type: 'string' },
          dateNaissance: { type: 'string', format: 'date-time' },
          sexe: { type: 'string' },
          groupeSanguin: { type: 'string' },
          allergies: { type: 'array', items: { type: 'string' } },
          maladiesChroniques: { type: 'array', items: { type: 'string' } },
          prefecture: { type: 'string' },
          sousPrefecture: { type: 'string' },
          village: { type: 'string' },
          photoUrl: { type: 'string' },
          urgenceNom: { type: 'string' },
          urgenceTelephone: { type: 'string' },
          creeLe: { type: 'string', format: 'date-time' },
          utilisateur: { $ref: '#/components/schemas/Utilisateur' },
        },
      },
      CreateConsultationDto: {
        type: 'object',
        required: ['idPatient', 'motifPrincipal'],
        properties: {
          idPatient: { type: 'string', example: 'clxxx123' },
          motifPrincipal: { type: 'string', example: 'Fièvre et maux de tête' },
          symptomes: { type: 'array', items: { type: 'string' }, example: ['Fièvre', 'Céphalées', 'Frissons'] },
        },
      },
      VitalsDto: {
        type: 'object',
        properties: {
          temperature: { type: 'number', example: 38.5, description: '°C — alerte si > 39.5' },
          poidsKg: { type: 'number', example: 65.5 },
          tailleCm: { type: 'number', example: 170 },
          perimetreBrachial: { type: 'number', example: 125, description: 'mm' },
          tensionSystolique: { type: 'integer', example: 120, description: 'mmHg' },
          tensionDiastolique: { type: 'integer', example: 80, description: 'mmHg' },
          frequenceCardiaque: { type: 'integer', example: 75, description: 'bpm' },
          frequenceRespiratoire: { type: 'integer', example: 18, description: 'resp/min' },
          spo2: { type: 'number', example: 98, description: '% — alerte si < 95' },
          glycemie: { type: 'number', example: 1.1, description: 'g/L — alerte si > 3' },
        },
      },
      DiagnosticDto: {
        type: 'object',
        required: ['libelle', 'source'],
        properties: {
          libelle: { type: 'string', example: 'Paludisme simple' },
          codeIcd11: { type: 'string', example: '1F40' },
          typeDiagnostic: { type: 'string', enum: ['PRINCIPAL', 'DIFFERENTIEL', 'SECONDAIRE'], default: 'PRINCIPAL' },
          severite: { type: 'string', enum: ['LEGER', 'MODERE', 'SEVERE', 'CRITIQUE'] },
          source: { type: 'string', enum: ['IA_LOCALE', 'IA_CLAUDE', 'MEDECIN', 'ASC'] },
        },
      },
      OrdonnanceDto: {
        type: 'object',
        required: ['idMedicament', 'posologie', 'frequence', 'dureeJours'],
        properties: {
          idMedicament: { type: 'string', example: 'clxxx456' },
          posologie: { type: 'string', example: '1 comprimé matin et soir' },
          frequence: { type: 'string', example: '2 fois par jour pendant 3 jours' },
          dureeJours: { type: 'integer', example: 3 },
          instructions: { type: 'string', example: 'Prendre avec de la nourriture' },
        },
      },
      ReferralDto: {
        type: 'object',
        required: ['idStructureCible', 'urgence', 'resumeClinique'],
        properties: {
          idStructureCible: { type: 'string', example: 'clxxx789' },
          urgence: { type: 'string', enum: ['ROUTINE', 'URGENT', 'URGENCE_VITALE'], example: 'URGENT' },
          resumeClinique: { type: 'string', example: 'Patient avec paludisme grave — fièvre > 39.5°C + convulsions' },
        },
      },
      Consultation: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          statut: { type: 'string', enum: ['PLANIFIEE', 'EN_COURS', 'TERMINEE', 'ANNULEE', 'REFERENCEE'] },
          motifPrincipal: { type: 'string' },
          symptomes: { type: 'array', items: { type: 'string' } },
          notesAsc: { type: 'string' },
          protocoleUtilise: { type: 'string' },
          confianceIa: { type: 'number' },
          resumeIa: { type: 'string' },
          consulteeLE: { type: 'string', format: 'date-time' },
          patient: { $ref: '#/components/schemas/PatientProfile' },
          constantes: { $ref: '#/components/schemas/VitalsDto' },
        },
      },
      CreateStockDto: {
        type: 'object',
        required: ['idMedicament', 'quantite', 'unite'],
        properties: {
          idMedicament: { type: 'string', example: 'clxxx123' },
          quantite: { type: 'integer', example: 50 },
          unite: { type: 'string', example: 'comprimés' },
          seuilAlerte: { type: 'integer', example: 10, description: 'Alerte si quantite <= seuil' },
          datePeremption: { type: 'string', format: 'date', example: '2027-06-30' },
        },
      },
      UpdateStockDto: {
        type: 'object',
        required: ['quantite', 'unite'],
        properties: {
          quantite: { type: 'integer', example: 35 },
          unite: { type: 'string', example: 'comprimés' },
          seuilAlerte: { type: 'integer', example: 10 },
          datePeremption: { type: 'string', format: 'date', example: '2027-06-30' },
        },
      },
      Stock: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          quantite: { type: 'integer' },
          seuilAlerte: { type: 'integer' },
          unite: { type: 'string' },
          datePeremption: { type: 'string', format: 'date-time' },
          enAlerte: { type: 'boolean', description: 'true si quantite <= seuilAlerte' },
          modifieLe: { type: 'string', format: 'date-time' },
          medicament: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              dci: { type: 'string' },
              nomCommercial: { type: 'string' },
              forme: { type: 'string' },
              dosage: { type: 'string' },
            },
          },
        },
      },
      RapportMensuel: {
        type: 'object',
        properties: {
          periode: { type: 'object', properties: { mois: { type: 'integer' }, annee: { type: 'integer' }, debut: { type: 'string', format: 'date-time' }, fin: { type: 'string', format: 'date-time' } } },
          statistiques: { type: 'object', properties: { totalConsultations: { type: 'integer' }, consultationsTerminees: { type: 'integer' }, totalReferences: { type: 'integer' }, totalVaccinations: { type: 'integer' }, totalRendezVous: { type: 'integer' }, rendezVousHonores: { type: 'integer' } } },
          topDiagnostics: { type: 'array', items: { type: 'object', properties: { libelle: { type: 'string' }, count: { type: 'integer' } } } },
          alertesStock: { type: 'integer' },
        },
      },
      ValiderConsultationDto: {
        type: 'object',
        required: ['notesMedecin'],
        properties: {
          notesMedecin: { type: 'string', example: 'Diagnostic confirmé — paludisme simple traité correctement' },
          idOrdonnances: { type: 'array', items: { type: 'string' }, description: 'IDs des ordonnances à signer' },
        },
      },
      RepondreReferencementDto: {
        type: 'object',
        required: ['statut'],
        properties: {
          statut: { type: 'string', enum: ['ACCEPTE', 'REFUSE'], example: 'ACCEPTE' },
          motifRefus: { type: 'string', example: 'Capacité insuffisante — redirectionner vers CHU' },
        },
      },
      SendMessageDto: {
        type: 'object',
        required: ['idDestinataire', 'contenu'],
        properties: {
          idDestinataire: { type: 'string', example: 'clxxx123' },
          contenu: { type: 'string', example: 'Bonjour, veuillez surveiller la tension artérielle du patient.' },
          idConsultation: { type: 'string', description: 'Optionnel — lier le message à une consultation' },
        },
      },
      DashboardStats: {
        type: 'object',
        properties: {
          consultationsValidees: { type: 'integer' },
          consultationsEnAttente: { type: 'integer' },
          referencementsEnAttente: { type: 'integer' },
          messagesNonLus: { type: 'integer' },
          structure: { type: 'object' },
        },
      },
      InitierPaiementDto: {
        type: 'object',
        required: ['idConsultation', 'montantGnf', 'modePaiement'],
        properties: {
          idConsultation: { type: 'string', example: 'clxxx123' },
          montantGnf: { type: 'integer', example: 50000, description: 'Montant en Francs Guinéens' },
          modePaiement: { type: 'string', enum: ['ORANGE_MONEY', 'MTN_MOMO', 'ESPECES'], example: 'ORANGE_MONEY' },
          numeroOperateur: { type: 'string', example: '+224621000000', description: 'Requis pour Orange Money et MTN MoMo' },
        },
      },
      ConfirmerPaiementDto: {
        type: 'object',
        required: ['referenceOperateur'],
        properties: {
          referenceOperateur: { type: 'string', example: 'OM-1745678901234-5678', description: "Référence de transaction retournée par l'opérateur" },
        },
      },
      Facture: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          montantGnf: { type: 'integer', description: 'Montant en Francs Guinéens' },
          statut: { type: 'string', enum: ['EN_ATTENTE', 'PAYEE', 'PARTIELLE', 'ANNULEE', 'REMBOURSEE'] },
          modePaiement: { type: 'string', enum: ['ORANGE_MONEY', 'MTN_MOMO', 'ESPECES'] },
          referenceOperateur: { type: 'string' },
          numeroOperateur: { type: 'string' },
          payeeLe: { type: 'string', format: 'date-time' },
          creeLe: { type: 'string', format: 'date-time' },
          patient: { $ref: '#/components/schemas/PatientProfile' },
          consultation: { $ref: '#/components/schemas/Consultation' },
        },
      },
      CreateVaccinationDto: {
        type: 'object',
        required: ['idPatient', 'vaccinNom'],
        properties: {
          idPatient: { type: 'string', example: 'clxxx123' },
          vaccinNom: { type: 'string', example: 'BCG' },
          codeEpi: { type: 'string', example: 'BCG-001', description: 'Code EPI national' },
          numeroLot: { type: 'string', example: 'LOT-2026-001' },
          siteInjection: { type: 'string', example: 'Bras gauche — deltoid' },
          reaction: { type: 'string', example: 'Aucune réaction observée' },
          dateProchaineD: { type: 'string', format: 'date', example: '2026-07-15', description: 'Date du prochain rappel' },
        },
      },
      UpdateVaccinationDto: {
        type: 'object',
        properties: {
          reaction: { type: 'string', example: "Légère rougeur au site d'injection" },
          urlCertificat: { type: 'string', example: 'https://s3.amazonaws.com/baobao/certificats/vaccin-123.pdf' },
          dateProchaineD: { type: 'string', format: 'date', example: '2026-07-15' },
        },
      },
      Vaccination: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          vaccinNom: { type: 'string' },
          codeEpi: { type: 'string' },
          numeroLot: { type: 'string' },
          siteInjection: { type: 'string' },
          reaction: { type: 'string' },
          urlCertificat: { type: 'string' },
          dateProchaineD: { type: 'string', format: 'date-time' },
          administreLe: { type: 'string', format: 'date-time' },
          patient: { $ref: '#/components/schemas/PatientProfile' },
          administrePar: { type: 'object', properties: { prenom: { type: 'string' }, nom: { type: 'string' }, role: { type: 'string' } } },
        },
      },
      StatsVaccination: {
        type: 'object',
        properties: {
          totalAdministrees: { type: 'integer' },
          topVaccins: { type: 'array', items: { type: 'object', properties: { vaccinNom: { type: 'string' }, count: { type: 'integer' } } } },
          parPrefecture: { type: 'string' },
        },
      },
      SendSmsDto: {
        type: 'object',
        required: ['telephone', 'message'],
        properties: {
          telephone: { type: 'string', example: '+224621000000', description: 'Numéro de téléphone destinataire' },
          message: { type: 'string', example: 'PLATEFORME: Votre rendez-vous est demain à 9h00.', description: 'Contenu du SMS (max 160 caractères)' },
        },
      },
      SmsMasseDto: {
        type: 'object',
        required: ['prefecture', 'message'],
        properties: {
          prefecture: { type: 'string', example: 'Conakry', description: 'Préfecture cible pour envoi en masse' },
          message: { type: 'string', example: 'PLATEFORME: Campagne de vaccination contre la rougeole — rendez-vous ce samedi.', description: 'Message à envoyer à tous les patients de la préfecture' },
        },
      },
      SmsResult: {
        type: 'object',
        properties: {
          messageId: { type: 'string', example: 'AT-1745678901234-5678', description: "ID de message Africa's Talking" },
          statut: { type: 'string', example: 'ENVOYE' },
        },
      },
      SmsMasseResult: {
        type: 'object',
        properties: {
          total: { type: 'integer', description: 'Nombre total de patients dans la préfecture' },
          envoyes: { type: 'integer', description: 'Nombre de SMS envoyés avec succès' },
          echoues: { type: 'integer', description: 'Nombre de SMS en échec' },
          prefecture: { type: 'string' },
        },
      },
      RappelsResult: {
        type: 'object',
        properties: {
          rendezVousARappeler: { type: 'integer', description: 'Nombre de RDV à rappeler demain' },
          vaccinationsARappeler: { type: 'integer', description: 'Nombre de vaccinations dues dans 7 jours' },
          ids: {
            type: 'object',
            properties: {
              rendezVous: { type: 'array', items: { type: 'string' } },
              vaccinations: { type: 'array', items: { type: 'string' } },
            },
          },
        },
      },
      // ─── Analytics ─────────────────────────────────────
      DashboardGlobal: {
        type: 'object',
        properties: {
          kpis: {
            type: 'object',
            properties: {
              totalPatients: { type: 'integer' },
              totalConsultations: { type: 'integer' },
              totalVaccinations: { type: 'integer' },
              totalReferencements: { type: 'integer' },
              totalAsc: { type: 'integer' },
            },
          },
          consultationsParStatut: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                statut: { type: 'string' },
                count: { type: 'integer' },
              },
            },
          },
          topPathologies: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                pathologie: { type: 'string' },
                count: { type: 'integer' },
              },
            },
          },
        },
      },
      HeatmapData: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            prefecture: { type: 'string' },
            count: { type: 'integer' },
            pathologies: { type: 'object', additionalProperties: { type: 'integer' } },
            latitude: { type: 'number' },
            longitude: { type: 'number' },
          },
        },
      },
      AlerteEpidemique: {
        type: 'object',
        properties: {
          pathologie: { type: 'string', example: 'Paludisme' },
          prefecture: { type: 'string', example: 'Conakry' },
          nombre: { type: 'integer', example: 25 },
          seuil: { type: 'integer', example: 20 },
          niveau: { type: 'string', enum: ['ATTENTION', 'ALERTE', 'URGENCE'], example: 'ALERTE' },
          dateDetection: { type: 'string', format: 'date-time' },
        },
      },
      CouvertureVaccinale: {
        type: 'object',
        properties: {
          totalPatients: { type: 'integer' },
          couverture: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                vaccin: { type: 'string' },
                patientsVaccines: { type: 'integer' },
                totalPatients: { type: 'integer' },
                tauxCouverture: { type: 'integer', description: 'Pourcentage 0-100' },
              },
            },
          },
          prefecture: { type: 'string' },
        },
      },
      TendanceMensuelle: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            mois: { type: 'string', example: 'avr. 2026' },
            consultations: { type: 'integer' },
            vaccinations: { type: 'integer' },
            referencements: { type: 'integer' },
          },
        },
      },
      ExportData: {
        type: 'object',
        properties: {
          format: { type: 'string', enum: ['JSON', 'CSV'] },
          total: { type: 'integer' },
          contenu: { type: 'object', description: 'Données JSON ou texte CSV selon le format choisi' },
        },
      },
    },
  },
  paths: {
    // ─── AUTH ─────────────────────────────────────────────
    '/api/v1/auth/register': {
      post: {
        tags: ['Authentification'],
        summary: 'Créer un nouveau compte',
        description: 'Enregistre un nouvel utilisateur et retourne une paire de tokens JWT',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/RegisterDto' } } } },
        responses: {
          201: { description: 'Compte créé avec succès', content: { 'application/json': { schema: { allOf: [{ $ref: '#/components/schemas/ApiResponse' }, { properties: { data: { $ref: '#/components/schemas/AuthAck' } } }] } } } },
          400: { description: 'Numéro déjà utilisé ou données invalides' },
        },
      },
    },
    '/api/v1/auth/login': {
      post: {
        tags: ['Authentification'],
        summary: 'Se connecter',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginDto' } } } },
        responses: {
          200: { description: 'Connexion réussie', content: { 'application/json': { schema: { allOf: [{ $ref: '#/components/schemas/ApiResponse' }, { properties: { data: { $ref: '#/components/schemas/AuthAck' } } }] } } } },
          401: { description: 'Identifiants invalides' },
        },
      },
    },
    '/api/v1/auth/refresh': {
      post: {
        tags: ['Authentification'],
        summary: 'Renouveler les tokens',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['refreshToken'], properties: { refreshToken: { type: 'string' } } } } } },
        responses: {
          200: { description: 'Tokens renouvelés', content: { 'application/json': { schema: { allOf: [{ $ref: '#/components/schemas/ApiResponse' }, { properties: { data: { $ref: '#/components/schemas/AuthAck' } } }] } } } },
          401: { description: 'Refresh token invalide ou expiré' },
        },
      },
    },
    '/api/v1/auth/logout': {
      post: { tags: ['Authentification'], summary: 'Se déconnecter', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Déconnexion réussie' }, 401: { description: 'Token manquant ou invalide' } } },
    },
    '/api/v1/auth/me': {
      get: {
        tags: ['Authentification'],
        summary: "Profil de l'utilisateur connecté",
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Profil récupéré', content: { 'application/json': { schema: { allOf: [{ $ref: '#/components/schemas/ApiResponse' }, { properties: { data: { $ref: '#/components/schemas/Utilisateur' } } }] } } } },
          401: { description: 'Non authentifié' },
          404: { description: 'Utilisateur non trouvé' },
        },
      },
    },
    // ─── PATIENTS ─────────────────────────────────────────
    '/api/v1/patients': {
      post: {
        tags: ['Patients'],
        summary: 'Créer un compte patient',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreatePatientDto' } } } },
        responses: {
          201: { description: 'Patient créé avec succès', content: { 'application/json': { schema: { allOf: [{ $ref: '#/components/schemas/ApiResponse' }, { properties: { data: { type: 'object', properties: { patient: { $ref: '#/components/schemas/PatientProfile' } } } } }] } } } },
          400: { description: 'Numéro déjà utilisé ou données invalides' },
        },
      },
      get: {
        tags: ['Patients'],
        summary: 'Liste des patients',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'prefecture', in: 'query', schema: { type: 'string' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Liste récupérée' }, 401: { description: 'Non authentifié' }, 403: { description: 'Accès refusé' } },
      },
    },
    '/api/v1/patients/me': {
      get: { tags: ['Patients'], summary: 'Mon profil patient', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Profil récupéré', content: { 'application/json': { schema: { allOf: [{ $ref: '#/components/schemas/ApiResponse' }, { properties: { data: { $ref: '#/components/schemas/PatientProfile' } } }] } } } }, 401: { description: 'Non authentifié' }, 404: { description: 'Profil non trouvé' } } },
      put: { tags: ['Patients'], summary: 'Mettre à jour mon profil', security: [{ bearerAuth: [] }], requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { prenom: { type: 'string' }, nom: { type: 'string' }, email: { type: 'string' }, langue: { type: 'string', enum: ['fr', 'pu', 'ml'] }, photoUrl: { type: 'string' }, groupeSanguin: { type: 'string' }, allergies: { type: 'array', items: { type: 'string' } }, maladiesChroniques: { type: 'array', items: { type: 'string' } } } } } } }, responses: { 200: { description: 'Profil mis à jour' }, 401: { description: 'Non authentifié' } } },
    },
    '/api/v1/patients/me/export': {
      get: { tags: ['Patients'], summary: 'Exporter mon dossier médical', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Dossier exporté' }, 401: { description: 'Non authentifié' }, 404: { description: 'Patient non trouvé' } } },
    },
    '/api/v1/patients/qr/{qrCode}': {
      get: { tags: ['Patients'], summary: 'Rechercher par QR Code', security: [{ bearerAuth: [] }], parameters: [{ name: 'qrCode', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Patient trouvé' }, 404: { description: 'Patient non trouvé' } } },
    },
    '/api/v1/patients/{id}': {
      get: { tags: ['Patients'], summary: "Détail d'un patient par ID", security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Patient trouvé' }, 404: { description: 'Patient non trouvé' } } },
    },
    // ─── CONSULTATIONS ────────────────────────────────────
    '/api/v1/consultations': {
      get: { tags: ['Consultations'], summary: 'Liste des consultations', security: [{ bearerAuth: [] }], parameters: [{ name: 'page', in: 'query', schema: { type: 'integer', default: 1 } }, { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } }, { name: 'idPatient', in: 'query', schema: { type: 'string' } }, { name: 'idAsc', in: 'query', schema: { type: 'string' } }], responses: { 200: { description: 'Liste récupérée' }, 401: { description: 'Non authentifié' }, 403: { description: 'Accès refusé' } } },
      post: { tags: ['Consultations'], summary: 'Ouvrir une nouvelle consultation', security: [{ bearerAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateConsultationDto' } } } }, responses: { 201: { description: 'Consultation créée', content: { 'application/json': { schema: { allOf: [{ $ref: '#/components/schemas/ApiResponse' }, { properties: { data: { $ref: '#/components/schemas/Consultation' } } }] } } } }, 400: { description: 'Données invalides' }, 403: { description: 'Profil ASC non trouvé' } } },
    },
    '/api/v1/consultations/{id}': {
      get: { tags: ['Consultations'], summary: "Détail d'une consultation", security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Consultation trouvée' }, 404: { description: 'Consultation non trouvée' } } },
      put: { tags: ['Consultations'], summary: 'Mettre à jour une consultation', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { motifPrincipal: { type: 'string' }, symptomes: { type: 'array', items: { type: 'string' } }, notesAsc: { type: 'string' }, protocoleUtilise: { type: 'string' }, confianceIa: { type: 'number' } } } } } }, responses: { 200: { description: 'Consultation mise à jour' }, 400: { description: 'Données invalides ou consultation terminée' } } },
    },
    '/api/v1/consultations/{id}/vitals': {
      post: { tags: ['Consultations'], summary: 'Saisir les constantes vitales', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/VitalsDto' } } } }, responses: { 200: { description: 'Constantes enregistrées' }, 400: { description: 'Consultation non trouvée' } } },
    },
    '/api/v1/consultations/{id}/complete': {
      post: { tags: ['Consultations'], summary: 'Clôturer une consultation', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Consultation clôturée' }, 400: { description: 'Consultation déjà terminée' } } },
    },
    '/api/v1/consultations/{id}/ordonnances': {
      post: { tags: ['Consultations'], summary: 'Prescrire un médicament (EF-05)', description: "Ajoute un médicament à l'ordonnance en cours de rédaction de la consultation. Si aucune ordonnance n'est ouverte, elle est créée avec son numéro (OR-AAAA-NNNNNN), son code de vérification et sa durée de validité. Deux médicaments prescrits pendant la même consultation forment donc une seule ordonnance.", security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/OrdonnanceDto' } } } }, responses: { 201: { description: "Ligne d'ordonnance ajoutée" }, 400: { description: 'Médicament non trouvé' } } },
    },
    // ─── Ordonnance : consultation et impression (EF-05, EF-06-02) ───
    '/api/v1/ordonnances/me': {
      get: { tags: ['Ordonnances'], summary: 'Mes ordonnances (patient)', description: "Les ordonnances du patient connecté, la plus récente d'abord. Le code de vérification en fait partie : c'est le secret que le patient présente au comptoir s'il n'a pas son QR.", security: [{ bearerAuth: [] }], responses: { 200: { description: 'Liste des ordonnances' }, 404: { description: 'Profil patient non trouvé' } } },
    },
    '/api/v1/ordonnances/{id}': {
      get: { tags: ['Ordonnances'], summary: 'Détail d’une ordonnance', description: "L'habilitation se juge sur la consultation : le patient son dossier, l'ASC ses consultations, le médecin celles de sa structure.", security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Ordonnance' }, 403: { description: 'Accès refusé' }, 404: { description: 'Ordonnance non trouvée' } } },
    },
    '/api/v1/ordonnances/{id}/document': {
      get: { tags: ['Ordonnances'], summary: 'Ordonnance imprimable (EF-06-02)', description: "Document HTML prêt pour `window.print`. Le couple numéro + code y figure encadré : c'est ce que le pharmacien saisit. Une ordonnance non signée ou expirée porte un filigrane, pour qu'aucun papier n'ait l'air opposable sans l'être.", security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Document HTML', content: { 'text/html': { schema: { type: 'string' } } } }, 403: { description: 'Accès refusé' }, 404: { description: 'Ordonnance non trouvée' } } },
    },
    // ─── Pharmacie : contrôle et délivrance (EF-07) ──────────
    '/api/v1/pharmacien/ordonnances/verifier': {
      post: {
        tags: ['Pharmacien'],
        summary: "Vérifier une ordonnance au comptoir (EF-07-01)",
        description: "Contrôle une ordonnance présentée sans le QR du patient. Le numéro seul ne suffit pas : il est séquentiel, donc devinable. Un numéro inconnu et un code faux renvoient la même réponse, pour qu'on ne puisse pas énumérer les numéros valides. Une ordonnance refusée est renvoyée avec son motif (non signée, expirée, annulée, déjà servie) afin que le pharmacien puisse l'expliquer au patient.",
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['numero', 'codeVerification'], properties: { numero: { type: 'string', example: 'OR-2026-000123' }, codeVerification: { type: 'string', example: 'A7D27Y' } } } } } },
        responses: { 200: { description: "Résultat du contrôle : `valide` indique si la délivrance est permise ; `motif` dit pourquoi elle ne l'est pas" }, 400: { description: 'Numéro mal formé' }, 403: { description: 'Compte non rattaché à une pharmacie' } },
      },
    },
    '/api/v1/pharmacien/ordonnances/{id}/delivrer': {
      post: {
        tags: ['Pharmacien'],
        summary: 'Délivrer un médicament (EF-07-07)',
        description: "`id` désigne une **ligne** d'ordonnance, pas l'ordonnance : la délivrance se fait médicament par médicament, une officine pouvant n'avoir qu'une partie du traitement. L'ordonnance est contrôlée avant toute sortie de stock ; son statut passe ensuite à PARTIELLEMENT_SERVIE ou SERVIE selon ce qu'il reste.",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: "Identifiant de la ligne d'ordonnance" }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { modePaiement: { type: 'string', enum: ['ESPECES', 'ORANGE_MONEY', 'MTN_MOMO'] }, quantiteDelivree: { type: 'integer', minimum: 1 } } } } } },
        responses: { 200: { description: 'Médicament délivré' }, 400: { description: "Ordonnance non signée, expirée, annulée, déjà servie, ou stock insuffisant" }, 404: { description: "Ligne d'ordonnance non trouvée" } },
      },
    },
    '/api/v1/consultations/{id}/referral': {
      post: { tags: ['Consultations'], summary: 'Créer un référencement', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ReferralDto' } } } }, responses: { 201: { description: 'Référencement créé' }, 400: { description: 'Référencement déjà existant ou structure non trouvée' } } },
    },
    // ─── ASC ──────────────────────────────────────────────
    '/api/v1/asc/planning': {
      get: { tags: ['ASC'], summary: "Planning de l'ASC", security: [{ bearerAuth: [] }], responses: { 200: { description: 'Planning récupéré' }, 404: { description: 'Profil ASC non trouvé' } } },
    },
    '/api/v1/asc/stocks': {
      get: { tags: ['ASC'], summary: 'Inventaire des stocks', security: [{ bearerAuth: [] }], parameters: [{ name: 'page', in: 'query', schema: { type: 'integer', default: 1 } }, { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } }, { name: 'seuilAlerte', in: 'query', schema: { type: 'boolean' } }], responses: { 200: { description: 'Stocks récupérés' } } },
      post: { tags: ['ASC'], summary: 'Créer un stock', security: [{ bearerAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateStockDto' } } } }, responses: { 201: { description: 'Stock créé' }, 400: { description: 'Stock déjà existant ou médicament non trouvé' } } },
    },
    '/api/v1/asc/stocks/{id}': {
      put: { tags: ['ASC'], summary: 'Mettre à jour un stock', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateStockDto' } } } }, responses: { 200: { description: 'Stock mis à jour' }, 400: { description: 'Stock non trouvé ou accès refusé' } } },
    },
    '/api/v1/asc/rapport': {
      get: { tags: ['ASC'], summary: 'Rapport mensuel', security: [{ bearerAuth: [] }], parameters: [{ name: 'mois', in: 'query', required: true, schema: { type: 'integer', minimum: 1, maximum: 12 }, example: 4 }, { name: 'annee', in: 'query', required: true, schema: { type: 'integer' }, example: 2026 }], responses: { 200: { description: 'Rapport généré', content: { 'application/json': { schema: { allOf: [{ $ref: '#/components/schemas/ApiResponse' }, { properties: { data: { $ref: '#/components/schemas/RapportMensuel' } } }] } } } }, 400: { description: 'Paramètres mois et annee requis' } } },
    },
    // ─── MEDECIN ──────────────────────────────────────────
    '/api/v1/medecin/dashboard': {
      get: { tags: ['Médecin'], summary: 'Dashboard statistiques', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Statistiques récupérées', content: { 'application/json': { schema: { allOf: [{ $ref: '#/components/schemas/ApiResponse' }, { properties: { data: { $ref: '#/components/schemas/DashboardStats' } } }] } } } } } },
    },
    '/api/v1/medecin/consultations': {
      get: { tags: ['Médecin'], summary: 'Consultations à valider', security: [{ bearerAuth: [] }], parameters: [{ name: 'page', in: 'query', schema: { type: 'integer', default: 1 } }, { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } }, { name: 'prefecture', in: 'query', schema: { type: 'string' } }], responses: { 200: { description: 'Liste récupérée' }, 401: { description: 'Non authentifié' }, 403: { description: 'Accès refusé' } } },
    },
    '/api/v1/medecin/consultations/{id}/valider': {
      put: { tags: ['Médecin'], summary: 'Valider une consultation', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ValiderConsultationDto' } } } }, responses: { 200: { description: 'Consultation validée' }, 400: { description: 'Consultation déjà validée ou non trouvée' } } },
    },
    '/api/v1/medecin/referencements': {
      get: { tags: ['Médecin'], summary: 'Référencements à traiter', security: [{ bearerAuth: [] }], parameters: [{ name: 'statut', in: 'query', schema: { type: 'string', enum: ['EN_ATTENTE', 'ACCEPTE', 'REFUSE', 'COMPLETE'] } }, { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } }, { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } }], responses: { 200: { description: 'Référencements récupérés' }, 401: { description: 'Non authentifié' } } },
    },
    '/api/v1/medecin/referencements/{id}/repondre': {
      put: { tags: ['Médecin'], summary: 'Répondre à un référencement', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/RepondreReferencementDto' } } } }, responses: { 200: { description: 'Réponse enregistrée' }, 400: { description: 'Référencement déjà traité ou motif manquant' } } },
    },
    '/api/v1/medecin/messages': {
      get: { tags: ['Médecin'], summary: 'Récupérer les messages', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Messages récupérés' }, 401: { description: 'Non authentifié' } } },
      post: { tags: ['Médecin'], summary: 'Envoyer un message', security: [{ bearerAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/SendMessageDto' } } } }, responses: { 201: { description: 'Message envoyé' }, 400: { description: 'Destinataire non trouvé' } } },
    },
    // ─── PAIEMENTS ────────────────────────────────────────
    '/api/v1/paiements': {
      post: { tags: ['Paiements'], summary: 'Initier un paiement', description: 'Crée une facture et initie un paiement Orange Money, MTN MoMo ou Espèces', security: [{ bearerAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/InitierPaiementDto' } } } }, responses: { 201: { description: 'Paiement initié', content: { 'application/json': { schema: { allOf: [{ $ref: '#/components/schemas/ApiResponse' }, { properties: { data: { $ref: '#/components/schemas/Facture' } } }] } } } }, 400: { description: 'Facture déjà existante ou numéro opérateur manquant' }, 403: { description: "Accès refusé — ce n'est pas votre consultation" } } },
    },
    '/api/v1/paiements/historique': {
      get: { tags: ['Paiements'], summary: 'Historique des paiements', security: [{ bearerAuth: [] }], parameters: [{ name: 'page', in: 'query', schema: { type: 'integer', default: 1 } }, { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } }, { name: 'statut', in: 'query', schema: { type: 'string', enum: ['EN_ATTENTE', 'PAYEE', 'PARTIELLE', 'ANNULEE', 'REMBOURSEE'] } }, { name: 'modePaiement', in: 'query', schema: { type: 'string', enum: ['ORANGE_MONEY', 'MTN_MOMO', 'ESPECES'] } }], responses: { 200: { description: 'Historique récupéré' }, 404: { description: 'Profil patient non trouvé' } } },
    },
    '/api/v1/paiements/{id}/statut': {
      get: { tags: ['Paiements'], summary: "Statut d'un paiement", security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Statut récupéré', content: { 'application/json': { schema: { allOf: [{ $ref: '#/components/schemas/ApiResponse' }, { properties: { data: { $ref: '#/components/schemas/Facture' } } }] } } } }, 404: { description: 'Facture non trouvée' } } },
    },
    '/api/v1/paiements/{id}/confirmer': {
      post: { tags: ['Paiements'], summary: 'Confirmer un paiement', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ConfirmerPaiementDto' } } } }, responses: { 200: { description: 'Paiement confirmé' }, 400: { description: 'Facture déjà payée ou non trouvée' } } },
    },
    '/api/v1/paiements/{id}/annuler': {
      post: { tags: ['Paiements'], summary: 'Annuler un paiement', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Paiement annulé' }, 400: { description: "Impossible d'annuler une facture déjà payée" } } },
    },
    // ─── VACCINATIONS ─────────────────────────────────────
    '/api/v1/vaccinations': {
      post: { tags: ['Vaccinations'], summary: 'Administrer un vaccin', security: [{ bearerAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateVaccinationDto' } } } }, responses: { 201: { description: 'Vaccination enregistrée', content: { 'application/json': { schema: { allOf: [{ $ref: '#/components/schemas/ApiResponse' }, { properties: { data: { $ref: '#/components/schemas/Vaccination' } } }] } } } }, 400: { description: 'Patient non trouvé' } } },
    },
    '/api/v1/vaccinations/me': {
      get: { tags: ['Vaccinations'], summary: 'Mon carnet vaccinal', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Carnet vaccinal récupéré', content: { 'application/json': { schema: { allOf: [{ $ref: '#/components/schemas/ApiResponse' }, { properties: { data: { type: 'array', items: { $ref: '#/components/schemas/Vaccination' } } } }] } } } }, 404: { description: 'Profil patient non trouvé' } } },
    },
    '/api/v1/vaccinations/rappels': {
      get: { tags: ['Vaccinations'], summary: 'Rappels de vaccination', security: [{ bearerAuth: [] }], parameters: [{ name: 'joursAvant', in: 'query', schema: { type: 'integer', default: 7 } }, { name: 'prefecture', in: 'query', schema: { type: 'string' } }], responses: { 200: { description: 'Rappels récupérés' } } },
    },
    '/api/v1/vaccinations/stats': {
      get: { tags: ['Vaccinations'], summary: 'Statistiques de vaccination', security: [{ bearerAuth: [] }], parameters: [{ name: 'prefecture', in: 'query', schema: { type: 'string' } }], responses: { 200: { description: 'Statistiques récupérées', content: { 'application/json': { schema: { allOf: [{ $ref: '#/components/schemas/ApiResponse' }, { properties: { data: { $ref: '#/components/schemas/StatsVaccination' } } }] } } } } } },
    },
    '/api/v1/vaccinations/patient/{id}': {
      get: { tags: ['Vaccinations'], summary: "Carnet vaccinal d'un patient", security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }, { name: 'vaccinNom', in: 'query', schema: { type: 'string' } }, { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } }, { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } }], responses: { 200: { description: 'Carnet vaccinal récupéré' }, 404: { description: 'Patient non trouvé' } } },
    },
    '/api/v1/vaccinations/{id}': {
      put: { tags: ['Vaccinations'], summary: 'Mettre à jour une vaccination', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateVaccinationDto' } } } }, responses: { 200: { description: 'Vaccination mise à jour' }, 400: { description: 'Vaccination non trouvée' } } },
    },
    // ─── NOTIFICATIONS ────────────────────────────────────
    '/api/v1/notifications/sms': {
      post: { tags: ['Notifications'], summary: 'Envoyer un SMS personnalisé', description: 'Envoie un SMS à un numéro spécifique — accessible Admin uniquement', security: [{ bearerAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/SendSmsDto' } } } }, responses: { 200: { description: 'SMS envoyé', content: { 'application/json': { schema: { allOf: [{ $ref: '#/components/schemas/ApiResponse' }, { properties: { data: { $ref: '#/components/schemas/SmsResult' } } }] } } } }, 400: { description: 'Numéro ou message invalide' }, 403: { description: 'Accès refusé — Admin requis' } } },
    },
    '/api/v1/notifications/sms/masse': {
      post: { tags: ['Notifications'], summary: 'SMS en masse par préfecture', description: "Envoie un SMS à tous les patients d'une préfecture — accessible Admin Régional et National", security: [{ bearerAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/SmsMasseDto' } } } }, responses: { 200: { description: 'SMS envoyés en masse', content: { 'application/json': { schema: { allOf: [{ $ref: '#/components/schemas/ApiResponse' }, { properties: { data: { $ref: '#/components/schemas/SmsMasseResult' } } }] } } } }, 400: { description: 'Prefecture ou message manquant' }, 403: { description: 'Accès refusé' } } },
    },
    '/api/v1/notifications/rappel/rendez-vous/{id}': {
      post: { tags: ['Notifications'], summary: 'Envoyer rappel de rendez-vous', description: 'Envoie un SMS de rappel au patient pour son rendez-vous — accessible ASC', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'ID du rendez-vous' }], responses: { 200: { description: 'Rappel envoyé', content: { 'application/json': { schema: { allOf: [{ $ref: '#/components/schemas/ApiResponse' }, { properties: { data: { $ref: '#/components/schemas/SmsResult' } } }] } } } }, 400: { description: 'Rendez-vous non trouvé' } } },
    },
    '/api/v1/notifications/rappel/vaccination/{id}': {
      post: { tags: ['Notifications'], summary: 'Envoyer rappel de vaccination', description: 'Envoie un SMS de rappel pour un prochain rappel vaccinal — accessible ASC et Médecin', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'ID de la vaccination' }], responses: { 200: { description: 'Rappel vaccinal envoyé', content: { 'application/json': { schema: { allOf: [{ $ref: '#/components/schemas/ApiResponse' }, { properties: { data: { $ref: '#/components/schemas/SmsResult' } } }] } } } }, 400: { description: 'Vaccination non trouvée' } } },
    },
    '/api/v1/notifications/alerte/stock/{id}': {
      post: { tags: ['Notifications'], summary: 'Envoyer alerte stock critique', description: "Envoie un SMS d'alerte à l'ASC pour un stock en dessous du seuil", security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'ID du stock' }], responses: { 200: { description: 'Alerte stock envoyée', content: { 'application/json': { schema: { allOf: [{ $ref: '#/components/schemas/ApiResponse' }, { properties: { data: { $ref: '#/components/schemas/SmsResult' } } }] } } } }, 400: { description: 'Stock non trouvé' } } },
    },
    '/api/v1/notifications/referencement/{id}': {
      post: { tags: ['Notifications'], summary: "Notifier le patient d'un référencement", description: "Envoie un SMS au patient pour l'informer de l'acceptation ou du refus de son référencement", security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'ID du référencement' }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['statut'], properties: { statut: { type: 'string', enum: ['ACCEPTE', 'REFUSE'], example: 'ACCEPTE' } } } } } }, responses: { 200: { description: 'Notification envoyée', content: { 'application/json': { schema: { allOf: [{ $ref: '#/components/schemas/ApiResponse' }, { properties: { data: { $ref: '#/components/schemas/SmsResult' } } }] } } } }, 400: { description: 'Statut invalide ou référencement non trouvé' } } },
    },
    '/api/v1/notifications/me': {
      get: { tags: ['Notifications'], summary: 'Mes notifications in-app', description: 'Notifications persistées de l\'utilisateur connecté, les plus récentes en premier. Les nouvelles arrivent aussi en temps réel via Socket.IO (événement notification:new).', security: [{ bearerAuth: [] }], parameters: [{ name: 'page', in: 'query', schema: { type: 'integer', default: 1 } }, { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } }, { name: 'lu', in: 'query', schema: { type: 'string', enum: ['true', 'false'] }, description: 'Filtrer sur les lues / non lues' }], responses: { 200: { description: 'Page de notifications ({ items, total, page, limit, totalPages })' } } },
    },
    '/api/v1/notifications/me/non-lues': {
      get: { tags: ['Notifications'], summary: 'Nombre de notifications non lues', security: [{ bearerAuth: [] }], responses: { 200: { description: '{ nonLues: number }' } } },
    },
    '/api/v1/notifications/{id}/lire': {
      put: { tags: ['Notifications'], summary: 'Marquer une notification comme lue', description: 'Idempotent. 404 si la notification n\'appartient pas à l\'utilisateur connecté.', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Notification mise à jour' }, 404: { description: 'Notification non trouvée' } } },
    },
    '/api/v1/notifications/tout-lire': {
      put: { tags: ['Notifications'], summary: 'Marquer toutes mes notifications comme lues', security: [{ bearerAuth: [] }], responses: { 200: { description: '{ marquees: number }' } } },
    },
    '/api/v1/notifications/rappels/verifier': {
      get: { tags: ['Notifications'], summary: 'Vérifier les rappels à envoyer', description: 'Retourne la liste des rendez-vous et vaccinations nécessitant un rappel — utile pour les CRON jobs', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Rappels identifiés', content: { 'application/json': { schema: { allOf: [{ $ref: '#/components/schemas/ApiResponse' }, { properties: { data: { $ref: '#/components/schemas/RappelsResult' } } }] } } } }, 403: { description: 'Accès refusé — Admin requis' } } },
    },
    // ─── ANALYTICS ────────────────────────────────────────
    '/api/v1/analytics/dashboard': {
      get: {
        tags: ['Analytics'],
        summary: 'Dashboard épidémiologique global',
        description: 'Retourne les KPIs globaux, consultations par statut et top pathologies — accessible Médecin, Admin',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'prefecture', in: 'query', schema: { type: 'string' }, description: 'Filtrer par préfecture' },
          { name: 'debut', in: 'query', schema: { type: 'string', format: 'date' }, example: '2026-01-01' },
          { name: 'fin', in: 'query', schema: { type: 'string', format: 'date' }, example: '2026-12-31' },
        ],
        responses: {
          200: {
            description: 'Dashboard récupéré',
            content: { 'application/json': { schema: { allOf: [{ $ref: '#/components/schemas/ApiResponse' }, { properties: { data: { $ref: '#/components/schemas/DashboardGlobal' } } }] } } },
          },
          403: { description: 'Accès refusé' },
        },
      },
    },
    '/api/v1/analytics/heatmap': {
      get: {
        tags: ['Analytics'],
        summary: 'Données cartographiques heatmap',
        description: 'Retourne les données géographiques des consultations par préfecture pour la carte épidémiologique',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'pathologie', in: 'query', schema: { type: 'string' }, description: 'Filtrer par pathologie', example: 'Paludisme' },
          { name: 'debut', in: 'query', schema: { type: 'string', format: 'date' }, example: '2026-01-01' },
          { name: 'fin', in: 'query', schema: { type: 'string', format: 'date' }, example: '2026-12-31' },
        ],
        responses: {
          200: {
            description: 'Données heatmap récupérées',
            content: { 'application/json': { schema: { allOf: [{ $ref: '#/components/schemas/ApiResponse' }, { properties: { data: { $ref: '#/components/schemas/HeatmapData' } } }] } } },
          },
          403: { description: 'Accès refusé' },
        },
      },
    },
    '/api/v1/analytics/alertes': {
      get: {
        tags: ['Analytics'],
        summary: 'Alertes épidémiques actives',
        description: 'Détecte automatiquement les pathologies dépassant les seuils sur les 30 derniers jours — triées par niveau URGENCE > ALERTE > ATTENTION',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Alertes récupérées',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    { properties: { data: { type: 'array', items: { $ref: '#/components/schemas/AlerteEpidemique' } } } },
                  ],
                },
              },
            },
          },
          403: { description: 'Accès refusé' },
        },
      },
    },
    '/api/v1/analytics/vaccinations/couverture': {
      get: {
        tags: ['Analytics'],
        summary: 'Taux de couverture vaccinale',
        description: 'Retourne le taux de couverture vaccinale par vaccin — utile pour les rapports ONG et Ministère de la Santé',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'prefecture', in: 'query', schema: { type: 'string' }, description: 'Filtrer par préfecture' },
        ],
        responses: {
          200: {
            description: 'Couverture vaccinale récupérée',
            content: { 'application/json': { schema: { allOf: [{ $ref: '#/components/schemas/ApiResponse' }, { properties: { data: { $ref: '#/components/schemas/CouvertureVaccinale' } } }] } } },
          },
          403: { description: 'Accès refusé' },
        },
      },
    },
    '/api/v1/analytics/tendances': {
      get: {
        tags: ['Analytics'],
        summary: 'Tendances sur 6 mois',
        description: 'Retourne les tendances mensuelles des consultations, vaccinations et référencements sur les 6 derniers mois',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'prefecture', in: 'query', schema: { type: 'string' }, description: 'Filtrer par préfecture' },
        ],
        responses: {
          200: {
            description: 'Tendances récupérées',
            content: { 'application/json': { schema: { allOf: [{ $ref: '#/components/schemas/ApiResponse' }, { properties: { data: { $ref: '#/components/schemas/TendanceMensuelle' } } }] } } },
          },
          403: { description: 'Accès refusé' },
        },
      },
    },
    '/api/v1/analytics/export': {
      get: {
        tags: ['Analytics'],
        summary: 'Exporter les données (DHIS2 / CSV)',
        description: 'Exporte les données de consultation au format JSON ou CSV — compatible DHIS2. Accessible Admin uniquement',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'format', in: 'query', schema: { type: 'string', enum: ['JSON', 'CSV', 'DHIS2'], default: 'JSON' }, description: 'Format d\'export' },
          { name: 'debut', in: 'query', schema: { type: 'string', format: 'date' }, example: '2026-01-01' },
          { name: 'fin', in: 'query', schema: { type: 'string', format: 'date' }, example: '2026-12-31' },
          { name: 'prefecture', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'Export généré — CSV retourné en téléchargement, JSON en body',
            content: {
              'application/json': { schema: { allOf: [{ $ref: '#/components/schemas/ApiResponse' }, { properties: { data: { $ref: '#/components/schemas/ExportData' } } }] } },
              'text/csv': { schema: { type: 'string', description: 'Fichier CSV téléchargeable' } },
            },
          },
          403: { description: 'Accès refusé — Admin requis' },
        },
      },
    },
    '/api/v1/sync/changes': {
      get: {
        tags: ['Sync Offline'],
        summary: 'Recuperer les changements offline',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'since', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 100 } },
          { name: 'scope', in: 'query', schema: { type: 'string', default: 'medical' } },
        ],
        responses: { 200: { description: 'Changements retournes' } },
      },
    },
    '/api/v1/sync/push': {
      post: {
        tags: ['Sync Offline'],
        summary: 'Envoyer des mutations offline',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  mutations: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['clientMutationId', 'entityType', 'operation', 'payload'],
                      properties: {
                        clientMutationId: { type: 'string' },
                        entityType: { type: 'string', enum: ['PatientProfile', 'Consultation', 'ConstantesVitales', 'Vaccination', 'Stock'] },
                        entityId: { type: 'string' },
                        operation: { type: 'string', enum: ['CREATE', 'UPDATE', 'DELETE'] },
                        payload: { type: 'object' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: { 202: { description: 'Mutations recues et traitees' } },
      },
    },
    '/api/v1/fhir/patients/{id}/bundle': {
      get: {
        tags: ['FHIR'],
        summary: 'Exporter le dossier patient en Bundle FHIR minimal',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Bundle FHIR' }, 403: { description: 'Consentement requis ou acces refuse' } },
      },
    },
    '/api/v1/fhir/patients/{id}': {
      get: {
        tags: ['FHIR'],
        summary: 'Exporter un Patient FHIR',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Patient FHIR' }, 403: { description: 'Consentement requis ou acces refuse' } },
      },
    },
    '/api/v1/fhir/consultations/{id}': {
      get: {
        tags: ['FHIR'],
        summary: 'Exporter une consultation en Encounter FHIR',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Encounter FHIR' } },
      },
    },
    '/api/v1/triage/evaluer': {
      post: {
        tags: ['Triage ASC'],
        summary: 'Evaluer les symptomes avec le moteur de regles ASC',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { symptomes: { type: 'array', items: { type: 'string' } }, constantes: { type: 'object' } } } } },
        },
        responses: { 200: { description: 'Hypotheses et recommandation' } },
      },
    },
    '/api/v1/privacy/me/consents': {
      get: {
        tags: ['Confidentialite'],
        summary: 'Lister mes consentements',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Consentements patient' } },
      },
      put: {
        tags: ['Confidentialite'],
        summary: 'Donner ou retirer un consentement',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['scope', 'actif'], properties: { scope: { type: 'string', enum: ['DOSSIER_MEDICAL', 'FHIR_EXPORT', 'RAPPELS_SMS', 'RECHERCHE_ANONYMISEE'] }, actif: { type: 'boolean' } } } } },
        },
        responses: { 200: { description: 'Consentement mis a jour' } },
      },
    },
    '/api/v1/privacy/me/audit-logs': {
      get: {
        tags: ['Confidentialite'],
        summary: 'Voir les acces a mon dossier',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Journal des acces' } },
      },
    },
    '/api/v1/ussd/session': {
      post: {
        tags: ['USSD'],
        summary: 'Endpoint callback USSD compatible agregateur',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['sessionId', 'phoneNumber'], properties: { sessionId: { type: 'string' }, phoneNumber: { type: 'string' }, text: { type: 'string' } } } } },
        },
        responses: { 200: { description: 'Reponse texte CON/END', content: { 'text/plain': { schema: { type: 'string' } } } } },
      },
    },
    // ── Parametres de la plateforme (feuille de route P0) ──────────────
    '/api/v1/parametres/publics': {
      get: {
        tags: ['Parametres'],
        summary: 'Identite publique de la plateforme (nom, logo, coordonnees) — sans authentification',
        responses: {
          200: {
            description: 'Identite courante',
            content: { 'application/json': { schema: { type: 'object', properties: {
              nom: { type: 'string', example: 'KÈNÈYA' },
              nomCourt: { type: 'string', example: 'KENEYA', description: 'Version sans accent pour SMS/USSD' },
              slogan: { type: 'string' }, logoUrl: { type: 'string' },
              adresse: { type: 'string' }, ville: { type: 'string' }, pays: { type: 'string' },
              telephone: { type: 'string' }, telephoneSupport: { type: 'string' },
              emailContact: { type: 'string' }, emailSupport: { type: 'string' }, emailExpediteur: { type: 'string' },
              siteWeb: { type: 'string' }, facebook: { type: 'string' }, whatsapp: { type: 'string' },
              copyright: { type: 'string' }, devise: { type: 'string', example: 'GNF' },
            } } } },
          },
        },
      },
    },
    '/api/v1/admin-structure/parametres': {
      get: { tags: ['Parametres'], summary: 'Parametres complets (SUPER_ADMIN)', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Sections identite, facturation, securite, alertes, sync' } } },
      put: {
        tags: ['Parametres'], summary: 'Mise a jour partielle, section par section (SUPER_ADMIN)', security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { identite: { type: 'object' }, facturation: { type: 'object' }, securite: { type: 'object' }, alertes: { type: 'object' }, sync: { type: 'object' } } } } } },
        responses: { 200: { description: 'Parametres a jour' }, 400: { description: 'Validation' } },
      },
    },
    // ── P1 Hopital : episodes de soins et demandes d'analyse (EF-03) ────
    '/api/v1/hopital/tableau-de-bord': { get: { tags: ['Hopital'], summary: 'Tableau de bord de l etablissement (EF-03-07)', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Compteurs et derniers episodes' } } } },
    '/api/v1/hopital/patients/recherche': {
      get: { tags: ['Hopital'], summary: 'Rechercher un patient avant admission (EF-03-01)', security: [{ bearerAuth: [] }],
        parameters: [{ name: 'q', in: 'query', required: true, schema: { type: 'string', minLength: 3 }, description: 'Nom, prenom, telephone ou QR code' }],
        responses: { 200: { description: 'Identites minimales, telephone masque, episode ouvert eventuel' } } },
    },
    '/api/v1/hopital/examens': { get: { tags: ['Hopital'], summary: 'Referentiel des examens (codes LOINC)', security: [{ bearerAuth: [] }], parameters: [{ name: 'q', in: 'query', schema: { type: 'string' } }, { name: 'categorie', in: 'query', schema: { type: 'string' } }], responses: { 200: { description: 'Examens actifs' } } } },
    '/api/v1/hopital/laboratoires': { get: { tags: ['Hopital'], summary: 'Structures pouvant recevoir une demande d analyse', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Laboratoires et hopitaux actifs' } } } },
    '/api/v1/hopital/medecins': { get: { tags: ['Hopital'], summary: 'Medecins de la structure (orientation)', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Liste' } } } },
    '/api/v1/hopital/episodes': {
      get: { tags: ['Hopital'], summary: 'Episodes de la structure', security: [{ bearerAuth: [] }], parameters: [{ name: 'statut', in: 'query', schema: { type: 'string', enum: ['OUVERT', 'EN_COURS', 'CLOS', 'ANNULE'] } }, { name: 'q', in: 'query', schema: { type: 'string' } }, { name: 'page', in: 'query', schema: { type: 'integer' } }, { name: 'limit', in: 'query', schema: { type: 'integer' } }], responses: { 200: { description: 'Page d episodes' } } },
      post: { tags: ['Hopital'], summary: 'Ouvrir un episode de soins (EF-03-02)', security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['idPatient', 'motif'], properties: { idPatient: { type: 'string' }, motif: { type: 'string' }, service: { type: 'string' }, idResponsable: { type: 'string' }, notes: { type: 'string' } } } } } },
        responses: { 201: { description: 'Episode numerote EP-AAAA-NNNNNN' }, 409: { description: 'Un episode est deja ouvert pour ce patient' } } },
    },
    '/api/v1/hopital/episodes/{id}': {
      get: { tags: ['Hopital'], summary: 'Detail d un episode', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Episode avec demandes et rendez-vous' } } },
      patch: { tags: ['Hopital'], summary: 'Modifier un episode', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { motif: { type: 'string' }, service: { type: 'string' }, idResponsable: { type: 'string', nullable: true }, notes: { type: 'string', nullable: true }, statut: { type: 'string', enum: ['OUVERT', 'EN_COURS'] } } } } } }, responses: { 200: { description: 'Episode a jour' } } },
    },
    '/api/v1/hopital/episodes/{id}/cloturer': { post: { tags: ['Hopital'], summary: 'Cloturer un episode', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Episode clos' } } } },
    '/api/v1/hopital/episodes/{id}/annuler': { post: { tags: ['Hopital'], summary: 'Annuler un episode', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Episode annule' } } } },
    '/api/v1/hopital/episodes/{id}/orientation': {
      post: { tags: ['Hopital'], summary: 'Orienter vers un medecin ou un service, rendez-vous propose (EF-03-05)', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { idMedecin: { type: 'string' }, service: { type: 'string' }, prevuLe: { type: 'string', format: 'date-time' }, motif: { type: 'string' } } } } } },
        responses: { 200: { description: 'Episode EN_COURS, rendez-vous cree si prevuLe' } } },
    },
    '/api/v1/hopital/episodes/{id}/demandes-analyse': {
      post: { tags: ['Hopital'], summary: 'Creer et transmettre une demande d analyse structuree (EF-03-03, EF-03-04)', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['idLaboratoire', 'examens'], properties: { idLaboratoire: { type: 'string' }, urgence: { type: 'string', enum: ['ROUTINE', 'URGENT', 'URGENCE_VITALE'] }, indicationClinique: { type: 'string' }, consignesPatient: { type: 'string' }, examens: { type: 'array', items: { type: 'object', required: ['idExamen'], properties: { idExamen: { type: 'string' }, commentaire: { type: 'string' } } } } } } } } },
        responses: { 201: { description: 'Demande DA-AAAA-NNNNNN transmise, patient notifie' } } },
    },
    '/api/v1/hopital/demandes-analyse/{id}': { get: { tags: ['Hopital'], summary: 'Detail d une demande d analyse', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Demande avec lignes' } } } },
    '/api/v1/hopital/demandes-analyse/{id}/annuler': { post: { tags: ['Hopital'], summary: 'Annuler une demande non prelevee', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['motif'], properties: { motif: { type: 'string' } } } } } }, responses: { 200: { description: 'Demande annulee' }, 409: { description: 'Prelevement deja realise' } } } },
    '/api/v1/hopital/demandes-analyse/{id}/document': { get: { tags: ['Hopital'], summary: 'Bon d examen imprimable (EF-03-06)', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'HTML pret a imprimer', content: { 'text/html': { schema: { type: 'string' } } } } } } },
    '/api/v1/patients/me/episodes': { get: { tags: ['Patients'], summary: 'Mon parcours hospitalier : episodes, analyses, rendez-vous', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Episodes du patient' } } } },
    '/api/v1/patients/me/demandes-analyse/{id}/document': { get: { tags: ['Patients'], summary: 'Mon bon d examen imprimable', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'HTML', content: { 'text/html': { schema: { type: 'string' } } } } } } },
    // ── P2 Laboratoire : prelevement, resultats, validation, critiques (EF-04) ──
    '/api/v1/laboratoire/tableau-de-bord': { get: { tags: ['Laboratoire'], summary: 'Tableau de bord du laboratoire', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Compteurs, prochains prelevements, file urgente' } } } },
    '/api/v1/laboratoire/demandes': { get: { tags: ['Laboratoire'], summary: 'File des demandes triee par urgence puis anciennete (EF-04-01)', security: [{ bearerAuth: [] }], parameters: [{ name: 'statut', in: 'query', schema: { type: 'string', enum: ['TRANSMISE', 'RECUE', 'PRELEVEE', 'EN_ANALYSE', 'VALIDEE', 'ANNULEE'] } }, { name: 'q', in: 'query', schema: { type: 'string' } }, { name: 'page', in: 'query', schema: { type: 'integer' } }, { name: 'limit', in: 'query', schema: { type: 'integer' } }], responses: { 200: { description: 'Page de demandes' } } } },
    '/api/v1/laboratoire/demandes/{id}': { get: { tags: ['Laboratoire'], summary: 'Detail : lignes, echantillons, resultats', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Demande' } } } },
    '/api/v1/laboratoire/demandes/{id}/reception': { post: { tags: ['Laboratoire'], summary: 'Accuser reception (TRANSMISE -> RECUE)', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Demande RECUE' }, 409: { description: 'Statut incompatible' } } } },
    '/api/v1/laboratoire/demandes/{id}/prelevement/planifier': { post: { tags: ['Laboratoire'], summary: 'Planifier le prelevement sur place ou a domicile, patient notifie (EF-04-02)', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['lieu'], properties: { lieu: { type: 'string', enum: ['SUR_PLACE', 'DOMICILE'] }, creneau: { type: 'string', format: 'date-time' } } } } } }, responses: { 200: { description: 'Creneau enregistre' } } } },
    '/api/v1/laboratoire/demandes/{id}/prelevement': { post: { tags: ['Laboratoire'], summary: 'Enregistrer le prelevement : echantillons codes EC-AAAA-NNNNNN (EF-04-03)', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { lieu: { type: 'string', enum: ['SUR_PLACE', 'DOMICILE'] }, echantillons: { type: 'array', description: 'Par defaut : un echantillon par type de specimen', items: { type: 'object', required: ['specimen'], properties: { specimen: { type: 'string' }, commentaire: { type: 'string' } } } } } } } } }, responses: { 201: { description: 'Demande PRELEVEE' } } } },
    '/api/v1/laboratoire/demandes/{id}/resultats': { put: { tags: ['Laboratoire'], summary: 'Saisir ou importer des resultats, lecture calculee d apres les references (EF-04-04, EF-04-06)', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['resultats'], properties: { resultats: { type: 'array', items: { type: 'object', required: ['valeur'], properties: { idLigne: { type: 'string' }, codeLoinc: { type: 'string', description: 'Alternative a idLigne (import automate)' }, valeur: { type: 'string' }, unite: { type: 'string' }, commentaire: { type: 'string' }, idEchantillon: { type: 'string' }, interpretation: { type: 'string', enum: ['NORMAL', 'ANORMAL', 'CRITIQUE'] } } } } } } } } }, responses: { 200: { description: 'Demande EN_ANALYSE avec resultats' } } } },
    '/api/v1/laboratoire/demandes/{id}/valider': { post: { tags: ['Laboratoire'], summary: 'Validation nominative du biologiste, bloquante avant diffusion (EF-04-05) ; alertes critiques au prescripteur (EF-04-07)', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { commentaire: { type: 'string' } } } } } }, responses: { 200: { description: 'Demande VALIDEE ; patient informe sauf resultat critique en attente d accuse' }, 403: { description: 'Reserve au role BIOLOGISTE' }, 400: { description: 'Resultat manquant' } } } },
    '/api/v1/laboratoire/demandes/{id}/compte-rendu': { get: { tags: ['Laboratoire'], summary: 'Compte rendu imprimable (filigrane NON VALIDE avant validation)', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'HTML', content: { 'text/html': { schema: { type: 'string' } } } } } } },
    '/api/v1/resultats/alertes': { get: { tags: ['Resultats'], summary: 'Mes alertes de resultats critiques, non accusees d abord (EF-04-08)', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Alertes' } } } },
    '/api/v1/resultats/alertes/{id}/accuser': { post: { tags: ['Resultats'], summary: 'Accuser lecture ; declenche la diffusion au patient si plus rien n est en attente (EF-04-09)', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Alerte accusee' } } } },
    '/api/v1/resultats/demandes/{id}/compte-rendu': { get: { tags: ['Resultats'], summary: 'Compte rendu d une demande de ma structure', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'HTML', content: { 'text/html': { schema: { type: 'string' } } } } } } },
    '/api/v1/resultats/patients/{idPatient}/examens-suivis': { get: { tags: ['Resultats'], summary: 'Examens numeriques disponibles pour une courbe', security: [{ bearerAuth: [] }], parameters: [{ name: 'idPatient', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Liste' }, 403: { description: 'Dossier non accessible' } } } },
    '/api/v1/resultats/patients/{idPatient}/evolution': { get: { tags: ['Resultats'], summary: 'Courbe d evolution d une valeur (EF-04-10)', security: [{ bearerAuth: [] }], parameters: [{ name: 'idPatient', in: 'path', required: true, schema: { type: 'string' } }, { name: 'codeLoinc', in: 'query', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Points dates avec references' } } } },
    '/api/v1/patients/me/demandes-analyse/{id}/compte-rendu': { get: { tags: ['Patients'], summary: 'Mon compte rendu de resultats (une fois diffuse)', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'HTML' }, 409: { description: 'Resultats non encore disponibles' } } } },
    '/api/v1/patients/me/resultats/examens-suivis': { get: { tags: ['Patients'], summary: 'Mes examens suivis dans le temps', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Liste' } } } },
    '/api/v1/patients/me/resultats/evolution': { get: { tags: ['Patients'], summary: 'Ma courbe d evolution pour un examen (EF-04-10)', security: [{ bearerAuth: [] }], parameters: [{ name: 'codeLoinc', in: 'query', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Points' } } } },
    '/api/v1/admin-structure/parametres/logo': {
      post: {
        tags: ['Parametres'], summary: 'Televerser le logo de la plateforme (SUPER_ADMIN)', security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', properties: { logo: { type: 'string', format: 'binary', description: 'PNG, JPEG, WebP ou SVG, 2 Mo max' } } } } } },
        responses: { 200: { description: 'Identite a jour avec logoUrl' }, 400: { description: 'Image refusee' } },
      },
    },
  },
};

// ─── Montage Swagger UI ───────────────────────────────────
export function setupSwagger(app: Express): void {
  // Le nom de la plateforme vient de la base : on l'injecte a chaque
  // affichage de la documentation plutot qu'au demarrage (il peut changer
  // depuis l'interface sans redemarrage de l'API).
  app.use('/api/docs', swaggerUi.serve, async (req: Request, res: Response, next: NextFunction) => {
    const nom = await getIdentitePlateforme().then((i) => i.nom).catch(() => 'Plateforme');
    const document = {
      ...swaggerDocument,
      info: { ...swaggerDocument.info, title: `${nom} API`, description: `API de la plateforme ${nom} — parcours de soins connecté` },
    };
    swaggerUi.setup(document, {
      customSiteTitle: `${nom} API Docs`,
      customCss: '.swagger-ui .topbar { background-color: #085041; }',
    })(req, res, next);
  });

  logger.debug(
    `Documentation API : http://localhost:${process.env.PORT ?? 3000}/api/docs`
  );
}

import { Express } from 'express';
import swaggerUi from 'swagger-ui-express';

export const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'BaoBaoHealth API',
    version: '1.0.0',
    description: 'API de la plateforme de santé numérique BaoBaoHealth — Guinée',
    contact: {
      name: 'BaoBaoHealth Team',
      email: 'dev@baobaoheath.com',
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
      // ─── Réponse standard ──────────────────────────────
      ApiResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: { type: 'object' },
          error: { type: 'string' },
        },
      },
      // ─── Auth ──────────────────────────────────────────
      RegisterDto: {
        type: 'object',
        required: ['telephone', 'motDePasse', 'prenom', 'nom'],
        properties: {
          telephone: { type: 'string', example: '+224621000000', description: 'Numéro de téléphone guinéen' },
          motDePasse: { type: 'string', example: 'MotDePasse123!', description: 'Minimum 8 caractères' },
          prenom: { type: 'string', example: 'Mamadou' },
          nom: { type: 'string', example: 'Diallo' },
          role: {
            type: 'string',
            enum: ['PATIENT', 'ASC', 'ASC_SUPERVISOR', 'MEDECIN', 'PHARMACIEN', 'ADMIN_STRUCTURE', 'ADMIN_REGIONAL', 'ADMIN_NATIONAL', 'SUPER_ADMIN'],
            default: 'PATIENT',
          },
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
      TokenPair: {
        type: 'object',
        properties: {
          accessToken: { type: 'string', description: 'JWT valide 15 minutes' },
          refreshToken: { type: 'string', description: 'JWT valide 7 jours' },
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
      // ─── Patients ──────────────────────────────────────
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
      // ─── Consultations ─────────────────────────────────
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
      // ─── ASC ───────────────────────────────────────────
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
          periode: {
            type: 'object',
            properties: {
              mois: { type: 'integer' },
              annee: { type: 'integer' },
              debut: { type: 'string', format: 'date-time' },
              fin: { type: 'string', format: 'date-time' },
            },
          },
          statistiques: {
            type: 'object',
            properties: {
              totalConsultations: { type: 'integer' },
              consultationsTerminees: { type: 'integer' },
              totalReferences: { type: 'integer' },
              totalVaccinations: { type: 'integer' },
              totalRendezVous: { type: 'integer' },
              rendezVousHonores: { type: 'integer' },
            },
          },
          topDiagnostics: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                libelle: { type: 'string' },
                count: { type: 'integer' },
              },
            },
          },
          alertesStock: { type: 'integer' },
        },
      },
      // ─── Médecin ───────────────────────────────────────
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
    },
  },
  paths: {
    // ─── AUTH ─────────────────────────────────────────────
    '/api/v1/auth/register': {
      post: {
        tags: ['Authentification'],
        summary: 'Créer un nouveau compte',
        description: 'Enregistre un nouvel utilisateur et retourne une paire de tokens JWT',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/RegisterDto' } } },
        },
        responses: {
          201: {
            description: 'Compte créé avec succès',
            content: {
              'application/json': {
                schema: { allOf: [{ $ref: '#/components/schemas/ApiResponse' }, { properties: { data: { $ref: '#/components/schemas/TokenPair' } } }] },
              },
            },
          },
          400: { description: 'Numéro déjà utilisé ou données invalides' },
        },
      },
    },
    '/api/v1/auth/login': {
      post: {
        tags: ['Authentification'],
        summary: 'Se connecter',
        description: 'Authentifie un utilisateur et retourne une paire de tokens JWT',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginDto' } } },
        },
        responses: {
          200: {
            description: 'Connexion réussie',
            content: {
              'application/json': {
                schema: { allOf: [{ $ref: '#/components/schemas/ApiResponse' }, { properties: { data: { $ref: '#/components/schemas/TokenPair' } } }] },
              },
            },
          },
          401: { description: 'Identifiants invalides' },
        },
      },
    },
    '/api/v1/auth/refresh': {
      post: {
        tags: ['Authentification'],
        summary: 'Renouveler les tokens',
        description: 'Génère une nouvelle paire de tokens à partir du refresh token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', required: ['refreshToken'], properties: { refreshToken: { type: 'string' } } },
            },
          },
        },
        responses: {
          200: {
            description: 'Tokens renouvelés',
            content: {
              'application/json': {
                schema: { allOf: [{ $ref: '#/components/schemas/ApiResponse' }, { properties: { data: { $ref: '#/components/schemas/TokenPair' } } }] },
              },
            },
          },
          401: { description: 'Refresh token invalide ou expiré' },
        },
      },
    },
    '/api/v1/auth/logout': {
      post: {
        tags: ['Authentification'],
        summary: 'Se déconnecter',
        description: "Révoque la session active de l'utilisateur",
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Déconnexion réussie' },
          401: { description: 'Token manquant ou invalide' },
        },
      },
    },
    '/api/v1/auth/me': {
      get: {
        tags: ['Authentification'],
        summary: "Profil de l'utilisateur connecté",
        description: "Retourne les informations de l'utilisateur authentifié",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Profil récupéré',
            content: {
              'application/json': {
                schema: { allOf: [{ $ref: '#/components/schemas/ApiResponse' }, { properties: { data: { $ref: '#/components/schemas/Utilisateur' } } }] },
              },
            },
          },
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
        description: 'Enregistre un nouveau patient et retourne une paire de tokens JWT',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreatePatientDto' } } },
        },
        responses: {
          201: {
            description: 'Patient créé avec succès',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    { properties: { data: { type: 'object', properties: { tokenPair: { $ref: '#/components/schemas/TokenPair' }, patient: { $ref: '#/components/schemas/PatientProfile' } } } } },
                  ],
                },
              },
            },
          },
          400: { description: 'Numéro déjà utilisé ou données invalides' },
        },
      },
      get: {
        tags: ['Patients'],
        summary: 'Liste des patients',
        description: 'Retourne la liste paginée des patients — accessible ASC, Médecin, Admin',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'prefecture', in: 'query', schema: { type: 'string' } },
          { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Recherche par nom, prénom ou téléphone' },
        ],
        responses: {
          200: {
            description: 'Liste récupérée',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { type: 'array', items: { $ref: '#/components/schemas/PatientProfile' } },
                    meta: { type: 'object', properties: { total: { type: 'integer' }, page: { type: 'integer' }, limit: { type: 'integer' }, totalPages: { type: 'integer' } } },
                  },
                },
              },
            },
          },
          401: { description: 'Non authentifié' },
          403: { description: 'Accès refusé' },
        },
      },
    },
    '/api/v1/patients/me': {
      get: {
        tags: ['Patients'],
        summary: 'Mon profil patient',
        description: 'Retourne le profil complet du patient connecté',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Profil récupéré',
            content: {
              'application/json': {
                schema: { allOf: [{ $ref: '#/components/schemas/ApiResponse' }, { properties: { data: { $ref: '#/components/schemas/PatientProfile' } } }] },
              },
            },
          },
          401: { description: 'Non authentifié' },
          404: { description: 'Profil non trouvé' },
        },
      },
      put: {
        tags: ['Patients'],
        summary: 'Mettre à jour mon profil',
        description: 'Met à jour les informations du patient connecté',
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  prenom: { type: 'string' }, nom: { type: 'string' }, email: { type: 'string' },
                  langue: { type: 'string', enum: ['fr', 'pu', 'ml'] }, photoUrl: { type: 'string' },
                  groupeSanguin: { type: 'string' },
                  allergies: { type: 'array', items: { type: 'string' } },
                  maladiesChroniques: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Profil mis à jour' },
          401: { description: 'Non authentifié' },
        },
      },
    },
    '/api/v1/patients/me/export': {
      get: {
        tags: ['Patients'],
        summary: 'Exporter mon dossier médical',
        description: 'Retourne le dossier médical complet du patient connecté',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Dossier exporté' },
          401: { description: 'Non authentifié' },
          404: { description: 'Patient non trouvé' },
        },
      },
    },
    '/api/v1/patients/qr/{qrCode}': {
      get: {
        tags: ['Patients'],
        summary: 'Rechercher par QR Code',
        description: 'Retourne le profil patient correspondant au QR Code scanné',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'qrCode', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Patient trouvé' },
          404: { description: 'Patient non trouvé' },
        },
      },
    },
    '/api/v1/patients/{id}': {
      get: {
        tags: ['Patients'],
        summary: "Détail d'un patient par ID",
        description: "Retourne le profil complet d'un patient — accessible ASC et Médecin",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Patient trouvé' },
          404: { description: 'Patient non trouvé' },
        },
      },
    },
    // ─── CONSULTATIONS ────────────────────────────────────
    '/api/v1/consultations': {
      get: {
        tags: ['Consultations'],
        summary: 'Liste des consultations',
        description: 'Retourne la liste paginée des consultations — ASC, Médecin, Admin',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'idPatient', in: 'query', schema: { type: 'string' } },
          { name: 'idAsc', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Liste récupérée' },
          401: { description: 'Non authentifié' },
          403: { description: 'Accès refusé' },
        },
      },
      post: {
        tags: ['Consultations'],
        summary: 'Ouvrir une nouvelle consultation',
        description: 'Crée une nouvelle consultation — accessible ASC uniquement',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateConsultationDto' } } },
        },
        responses: {
          201: {
            description: 'Consultation créée',
            content: {
              'application/json': {
                schema: { allOf: [{ $ref: '#/components/schemas/ApiResponse' }, { properties: { data: { $ref: '#/components/schemas/Consultation' } } }] },
              },
            },
          },
          400: { description: 'Données invalides' },
          403: { description: 'Profil ASC non trouvé' },
        },
      },
    },
    '/api/v1/consultations/{id}': {
      get: {
        tags: ['Consultations'],
        summary: "Détail d'une consultation",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Consultation trouvée' },
          404: { description: 'Consultation non trouvée' },
        },
      },
      put: {
        tags: ['Consultations'],
        summary: 'Mettre à jour une consultation',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  motifPrincipal: { type: 'string' }, symptomes: { type: 'array', items: { type: 'string' } },
                  notesAsc: { type: 'string' }, protocoleUtilise: { type: 'string' }, confianceIa: { type: 'number' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Consultation mise à jour' },
          400: { description: 'Données invalides ou consultation terminée' },
        },
      },
    },
    '/api/v1/consultations/{id}/vitals': {
      post: {
        tags: ['Consultations'],
        summary: 'Saisir les constantes vitales',
        description: 'Enregistre les constantes vitales et déclenche les alertes automatiques',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/VitalsDto' } } },
        },
        responses: {
          200: { description: 'Constantes enregistrées — alertes calculées automatiquement' },
          400: { description: 'Consultation non trouvée' },
        },
      },
    },
    '/api/v1/consultations/{id}/complete': {
      post: {
        tags: ['Consultations'],
        summary: 'Clôturer une consultation',
        description: 'Change le statut de la consultation à TERMINEE',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Consultation clôturée' },
          400: { description: 'Consultation déjà terminée' },
        },
      },
    },
    '/api/v1/consultations/{id}/diagnostics': {
      get: {
        tags: ['Consultations'],
        summary: 'Liste des diagnostics',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Diagnostics récupérés' } },
      },
      post: {
        tags: ['Consultations'],
        summary: 'Ajouter un diagnostic',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/DiagnosticDto' } } },
        },
        responses: {
          201: { description: 'Diagnostic ajouté' },
          400: { description: 'Données invalides' },
        },
      },
    },
    '/api/v1/consultations/{id}/ordonnances': {
      post: {
        tags: ['Consultations'],
        summary: 'Ajouter une ordonnance',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/OrdonnanceDto' } } },
        },
        responses: {
          201: { description: 'Ordonnance ajoutée' },
          400: { description: 'Médicament non trouvé' },
        },
      },
    },
    '/api/v1/consultations/{id}/referral': {
      post: {
        tags: ['Consultations'],
        summary: 'Créer un référencement',
        description: 'Transfère le patient vers une structure de santé supérieure',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ReferralDto' } } },
        },
        responses: {
          201: { description: 'Référencement créé' },
          400: { description: 'Référencement déjà existant ou structure non trouvée' },
        },
      },
    },
    // ─── ASC ──────────────────────────────────────────────
    '/api/v1/asc/me': {
      get: {
        tags: ['ASC'],
        summary: "Profil ASC connecté",
        description: "Retourne le profil complet de l'ASC connecté",
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Profil récupéré' },
          404: { description: 'Profil ASC non trouvé' },
        },
      },
      put: {
        tags: ['ASC'],
        summary: 'Mettre à jour le profil ASC',
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  numeroCertification: { type: 'string' },
                  photoUrl: { type: 'string' },
                  zoneCouverture: {
                    type: 'object',
                    properties: {
                      prefecture: { type: 'string' },
                      sousPrefectures: { type: 'array', items: { type: 'string' } },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Profil mis à jour' },
          400: { description: 'Données invalides' },
        },
      },
    },
    '/api/v1/asc/patients': {
      get: {
        tags: ['ASC'],
        summary: 'Patients de la zone ASC',
        description: "Retourne la liste des patients vus par cet ASC",
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Liste récupérée' },
          404: { description: 'Profil ASC non trouvé' },
        },
      },
    },
    '/api/v1/asc/planning': {
      get: {
        tags: ['ASC'],
        summary: "Planning de l'ASC",
        description: "Retourne les rendez-vous à venir de l'ASC",
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Planning récupéré' },
          404: { description: 'Profil ASC non trouvé' },
        },
      },
    },
    '/api/v1/asc/stocks': {
      get: {
        tags: ['ASC'],
        summary: 'Inventaire des stocks',
        description: "Retourne les stocks de médicaments de l'ASC",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'seuilAlerte', in: 'query', schema: { type: 'boolean' }, description: 'Filtrer uniquement les stocks en alerte' },
        ],
        responses: {
          200: {
            description: 'Stocks récupérés',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { type: 'array', items: { $ref: '#/components/schemas/Stock' } },
                    meta: { type: 'object', properties: { total: { type: 'integer' }, page: { type: 'integer' }, alertes: { type: 'integer' } } },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['ASC'],
        summary: "Créer un stock",
        description: "Ajoute un médicament à l'inventaire de l'ASC",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateStockDto' } } },
        },
        responses: {
          201: { description: 'Stock créé' },
          400: { description: 'Stock déjà existant ou médicament non trouvé' },
        },
      },
    },
    '/api/v1/asc/stocks/{id}': {
      put: {
        tags: ['ASC'],
        summary: 'Mettre à jour un stock',
        description: "Met à jour la quantité et les informations d'un stock",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateStockDto' } } },
        },
        responses: {
          200: { description: 'Stock mis à jour' },
          400: { description: 'Stock non trouvé ou accès refusé' },
        },
      },
    },
    '/api/v1/asc/rapport': {
      get: {
        tags: ['ASC'],
        summary: 'Rapport mensuel',
        description: "Retourne le rapport d'activité mensuel de l'ASC",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'mois', in: 'query', required: true, schema: { type: 'integer', minimum: 1, maximum: 12 }, example: 4 },
          { name: 'annee', in: 'query', required: true, schema: { type: 'integer' }, example: 2026 },
        ],
        responses: {
          200: {
            description: 'Rapport généré',
            content: {
              'application/json': {
                schema: { allOf: [{ $ref: '#/components/schemas/ApiResponse' }, { properties: { data: { $ref: '#/components/schemas/RapportMensuel' } } }] },
              },
            },
          },
          400: { description: 'Paramètres mois et annee requis' },
        },
      },
    },
    // ─── MEDECIN ──────────────────────────────────────────
    '/api/v1/medecin/me': {
      get: {
        tags: ['Médecin'],
        summary: 'Profil médecin connecté',
        description: 'Retourne le profil complet du médecin connecté',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Profil récupéré' },
          404: { description: 'Médecin non trouvé' },
        },
      },
    },
    '/api/v1/medecin/dashboard': {
      get: {
        tags: ['Médecin'],
        summary: 'Dashboard statistiques',
        description: 'Retourne les statistiques globales du médecin',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Statistiques récupérées',
            content: {
              'application/json': {
                schema: { allOf: [{ $ref: '#/components/schemas/ApiResponse' }, { properties: { data: { $ref: '#/components/schemas/DashboardStats' } } }] },
              },
            },
          },
        },
      },
    },
    '/api/v1/medecin/consultations': {
      get: {
        tags: ['Médecin'],
        summary: 'Consultations à valider',
        description: 'Retourne la liste des consultations terminées en attente de validation médicale',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'prefecture', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Liste récupérée' },
          401: { description: 'Non authentifié' },
          403: { description: 'Accès refusé' },
        },
      },
    },
    '/api/v1/medecin/consultations/{id}/valider': {
      put: {
        tags: ['Médecin'],
        summary: 'Valider une consultation',
        description: 'Valide une consultation et signe les ordonnances sélectionnées',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ValiderConsultationDto' } } },
        },
        responses: {
          200: { description: 'Consultation validée et ordonnances signées' },
          400: { description: 'Consultation déjà validée ou non trouvée' },
        },
      },
    },
    '/api/v1/medecin/referencements': {
      get: {
        tags: ['Médecin'],
        summary: 'Référencements à traiter',
        description: 'Retourne les référencements en attente de réponse',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'statut', in: 'query', schema: { type: 'string', enum: ['EN_ATTENTE', 'ACCEPTE', 'REFUSE', 'COMPLETE'] } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: {
          200: { description: 'Référencements récupérés' },
          401: { description: 'Non authentifié' },
        },
      },
    },
    '/api/v1/medecin/referencements/{id}/repondre': {
      put: {
        tags: ['Médecin'],
        summary: 'Répondre à un référencement',
        description: 'Accepte ou refuse un référencement de patient',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/RepondreReferencementDto' } } },
        },
        responses: {
          200: { description: 'Réponse enregistrée' },
          400: { description: 'Référencement déjà traité ou motif manquant' },
        },
      },
    },
    '/api/v1/medecin/messages': {
      get: {
        tags: ['Médecin'],
        summary: 'Récupérer les messages',
        description: 'Retourne tous les messages envoyés et reçus — marque les messages comme lus',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Messages récupérés' },
          401: { description: 'Non authentifié' },
        },
      },
      post: {
        tags: ['Médecin'],
        summary: 'Envoyer un message',
        description: 'Envoie un message à un ASC ou autre utilisateur',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/SendMessageDto' } } },
        },
        responses: {
          201: { description: 'Message envoyé' },
          400: { description: 'Destinataire non trouvé' },
        },
      },
    },
  },
};

// ─── Montage Swagger UI ───────────────────────────────────
export function setupSwagger(app: Express): void {
  app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerDocument, {
      customSiteTitle: 'BaoBaoHealth API Docs',
      customCss: '.swagger-ui .topbar { background-color: #085041; }',
    })
  );

  console.log(
    `Documentation API : http://localhost:${process.env.PORT ?? 3000}/api/docs`
  );
}
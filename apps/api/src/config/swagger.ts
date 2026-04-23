import { Express } from 'express';
import swaggerUi from 'swagger-ui-express';

// ─── Définition OpenAPI 3.0 ───────────────────────────────
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
          telephone: {
            type: 'string',
            example: '+224621000000',
            description: 'Numéro de téléphone guinéen',
          },
          motDePasse: {
            type: 'string',
            example: 'MotDePasse123!',
            description: 'Minimum 8 caractères',
          },
          prenom: { type: 'string', example: 'Mamadou' },
          nom: { type: 'string', example: 'Diallo' },
          role: {
            type: 'string',
            enum: [
              'PATIENT', 'ASC', 'ASC_SUPERVISOR', 'MEDECIN',
              'PHARMACIEN', 'ADMIN_STRUCTURE', 'ADMIN_REGIONAL',
              'ADMIN_NATIONAL', 'SUPER_ADMIN',
            ],
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
          allergies: {
            type: 'array',
            items: { type: 'string' },
            example: ['Pénicilline'],
          },
          maladiesChroniques: {
            type: 'array',
            items: { type: 'string' },
            example: ['Diabète'],
          },
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
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RegisterDto' },
            },
          },
        },
        responses: {
          201: {
            description: 'Compte créé avec succès',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    { properties: { data: { $ref: '#/components/schemas/TokenPair' } } },
                  ],
                },
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
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LoginDto' },
            },
          },
        },
        responses: {
          200: {
            description: 'Connexion réussie',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    { properties: { data: { $ref: '#/components/schemas/TokenPair' } } },
                  ],
                },
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
              schema: {
                type: 'object',
                required: ['refreshToken'],
                properties: {
                  refreshToken: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Tokens renouvelés',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    { properties: { data: { $ref: '#/components/schemas/TokenPair' } } },
                  ],
                },
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
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    { properties: { data: { $ref: '#/components/schemas/Utilisateur' } } },
                  ],
                },
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
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreatePatientDto' },
            },
          },
        },
        responses: {
          201: {
            description: 'Patient créé avec succès',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      properties: {
                        data: {
                          type: 'object',
                          properties: {
                            tokenPair: { $ref: '#/components/schemas/TokenPair' },
                            patient: { $ref: '#/components/schemas/PatientProfile' },
                          },
                        },
                      },
                    },
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
          {
            name: 'search',
            in: 'query',
            schema: { type: 'string' },
            description: 'Recherche par nom, prénom ou téléphone',
          },
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
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/PatientProfile' },
                    },
                    meta: {
                      type: 'object',
                      properties: {
                        total: { type: 'integer' },
                        page: { type: 'integer' },
                        limit: { type: 'integer' },
                        totalPages: { type: 'integer' },
                      },
                    },
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
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    { properties: { data: { $ref: '#/components/schemas/PatientProfile' } } },
                  ],
                },
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
                  prenom: { type: 'string' },
                  nom: { type: 'string' },
                  email: { type: 'string' },
                  langue: { type: 'string', enum: ['fr', 'pu', 'ml'] },
                  photoUrl: { type: 'string' },
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
        parameters: [
          {
            name: 'qrCode',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
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
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Patient trouvé' },
          404: { description: 'Patient non trouvé' },
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
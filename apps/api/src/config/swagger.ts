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
          prenom: {
            type: 'string',
            example: 'Mamadou',
          },
          nom: {
            type: 'string',
            example: 'Diallo',
          },
          role: {
            type: 'string',
            enum: [
              'PATIENT',
              'ASC',
              'ASC_SUPERVISOR',
              'MEDECIN',
              'PHARMACIEN',
              'ADMIN_STRUCTURE',
              'ADMIN_REGIONAL',
              'ADMIN_NATIONAL',
              'SUPER_ADMIN',
            ],
            default: 'PATIENT',
          },
        },
      },
      LoginDto: {
        type: 'object',
        required: ['telephone', 'motDePasse'],
        properties: {
          telephone: {
            type: 'string',
            example: '+224621000000',
          },
          motDePasse: {
            type: 'string',
            example: 'MotDePasse123!',
          },
        },
      },
      TokenPair: {
        type: 'object',
        properties: {
          accessToken: {
            type: 'string',
            description: 'JWT valide 15 minutes',
          },
          refreshToken: {
            type: 'string',
            description: 'JWT valide 7 jours',
          },
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
                    {
                      properties: {
                        data: { $ref: '#/components/schemas/TokenPair' },
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
                    {
                      properties: {
                        data: { $ref: '#/components/schemas/TokenPair' },
                      },
                    },
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
                    {
                      properties: {
                        data: { $ref: '#/components/schemas/TokenPair' },
                      },
                    },
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
        description: 'Révoque la session active de l\'utilisateur',
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
        summary: 'Profil de l\'utilisateur connecté',
        description: 'Retourne les informations de l\'utilisateur authentifié',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Profil récupéré',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      properties: {
                        data: { $ref: '#/components/schemas/Utilisateur' },
                      },
                    },
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

  console.log(`Documentation API : http://localhost:${process.env.PORT ?? 3000}/api/docs`);
}
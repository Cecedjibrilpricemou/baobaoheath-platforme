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
          message: { type: 'string', example: 'BaoBaoHealth: Votre rendez-vous est demain à 9h00.', description: 'Contenu du SMS (max 160 caractères)' },
        },
      },
      SmsMasseDto: {
        type: 'object',
        required: ['prefecture', 'message'],
        properties: {
          prefecture: { type: 'string', example: 'Conakry', description: 'Préfecture cible pour envoi en masse' },
          message: { type: 'string', example: 'BaoBaoHealth: Campagne de vaccination contre la rougeole — rendez-vous ce samedi.', description: 'Message à envoyer à tous les patients de la préfecture' },
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
          201: { description: 'Compte créé avec succès', content: { 'application/json': { schema: { allOf: [{ $ref: '#/components/schemas/ApiResponse' }, { properties: { data: { $ref: '#/components/schemas/TokenPair' } } }] } } } },
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
          200: { description: 'Connexion réussie', content: { 'application/json': { schema: { allOf: [{ $ref: '#/components/schemas/ApiResponse' }, { properties: { data: { $ref: '#/components/schemas/TokenPair' } } }] } } } },
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
          200: { description: 'Tokens renouvelés', content: { 'application/json': { schema: { allOf: [{ $ref: '#/components/schemas/ApiResponse' }, { properties: { data: { $ref: '#/components/schemas/TokenPair' } } }] } } } },
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
          201: { description: 'Patient créé avec succès', content: { 'application/json': { schema: { allOf: [{ $ref: '#/components/schemas/ApiResponse' }, { properties: { data: { type: 'object', properties: { tokenPair: { $ref: '#/components/schemas/TokenPair' }, patient: { $ref: '#/components/schemas/PatientProfile' } } } } }] } } } },
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
    '/api/v1/consultations/{id}/diagnostics': {
      get: { tags: ['Consultations'], summary: 'Liste des diagnostics', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Diagnostics récupérés' } } },
      post: { tags: ['Consultations'], summary: 'Ajouter un diagnostic', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/DiagnosticDto' } } } }, responses: { 201: { description: 'Diagnostic ajouté' }, 400: { description: 'Données invalides' } } },
    },
    '/api/v1/consultations/{id}/ordonnances': {
      post: { tags: ['Consultations'], summary: 'Ajouter une ordonnance', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/OrdonnanceDto' } } } }, responses: { 201: { description: 'Ordonnance ajoutée' }, 400: { description: 'Médicament non trouvé' } } },
    },
    '/api/v1/consultations/{id}/referral': {
      post: { tags: ['Consultations'], summary: 'Créer un référencement', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ReferralDto' } } } }, responses: { 201: { description: 'Référencement créé' }, 400: { description: 'Référencement déjà existant ou structure non trouvée' } } },
    },
    // ─── ASC ──────────────────────────────────────────────
    '/api/v1/asc/me': {
      get: { tags: ['ASC'], summary: 'Profil ASC connecté', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Profil récupéré' }, 404: { description: 'Profil ASC non trouvé' } } },
      put: { tags: ['ASC'], summary: 'Mettre à jour le profil ASC', security: [{ bearerAuth: [] }], requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { numeroCertification: { type: 'string' }, photoUrl: { type: 'string' }, zoneCouverture: { type: 'object', properties: { prefecture: { type: 'string' }, sousPrefectures: { type: 'array', items: { type: 'string' } } } } } } } } }, responses: { 200: { description: 'Profil mis à jour' }, 400: { description: 'Données invalides' } } },
    },
    '/api/v1/asc/patients': {
      get: { tags: ['ASC'], summary: 'Patients de la zone ASC', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Liste récupérée' }, 404: { description: 'Profil ASC non trouvé' } } },
    },
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
    '/api/v1/medecin/me': {
      get: { tags: ['Médecin'], summary: 'Profil médecin connecté', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Profil récupéré' }, 404: { description: 'Médecin non trouvé' } } },
    },
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

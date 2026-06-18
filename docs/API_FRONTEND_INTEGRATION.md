# BaoBaoHealth - APIs backend a integrer dans le frontend

Ce fichier liste uniquement les endpoints reels exposes par le backend `apps/api`.

Base URL frontend:

```text
http://localhost:3000/api/v1
```

Header obligatoire pour les routes protegees:

```http
Authorization: Bearer <accessToken>
Content-Type: application/json
```

Format general des reponses JSON:

```json
{
  "success": true,
  "data": {}
}
```

Format courant en cas d'erreur:

```json
{
  "success": false,
  "error": "Message erreur",
  "details": []
}
```

Roles backend:

```text
PATIENT
ASC
ASC_SUPERVISOR
MEDECIN
PHARMACIEN
ADMIN_STRUCTURE
ADMIN_REGIONAL
ADMIN_NATIONAL
SUPER_ADMIN
```

## 1. Authentification

Prefixe:

```text
/auth
```

| Methode | Endpoint | Auth | Roles | Usage frontend |
|---|---|---:|---|---|
| POST | `/auth/register` | Non | Public | Inscription simple utilisateur patient |
| POST | `/auth/login` | Non | Public | Connexion |
| POST | `/auth/verify-otp` | Non | Public | Verification OTP des utilisateurs non-patients |
| POST | `/auth/refresh` | Non | Public | Renouveler les tokens |
| POST | `/auth/logout` | Oui | Tous | Deconnexion |
| GET | `/auth/me` | Oui | Tous | Recuperer utilisateur connecte |
| PUT | `/auth/change-password` | Oui | Tous | Changer mot de passe |
| PUT | `/auth/profile` | Oui | Tous | Modifier profil utilisateur commun |

### POST `/auth/register`

Body:

```json
{
  "telephone": "622000000",
  "email": "patient@example.com",
  "motDePasse": "secret123",
  "prenom": "Mamadou",
  "nom": "Diallo"
}
```

Important frontend:

- Cette route cree uniquement un compte `PATIENT`.
- Ne pas envoyer `role`.

### POST `/auth/login`

Body:

```json
{
  "identifiant": "agent@structure.com",
  "motDePasse": "secret123"
}
```

Cas 1 - patient:

```json
{
  "success": true,
  "data": {
    "accessToken": "...",
    "refreshToken": "..."
  }
}
```

Cas 2 - utilisateur non-patient: `ASC`, `MEDECIN`, `PHARMACIEN`, `ADMIN_STRUCTURE`, etc.

```json
{
  "success": true,
  "data": {
    "requiresOtp": true,
    "email": "agent@structure.com",
    "message": "Un code OTP de 6 chiffres a ete envoye a votre adresse email",
    "expiresInMinutes": 10
  }
}
```

Important:

- Les patients peuvent se connecter normalement.
- Tous les autres utilisateurs doivent se connecter avec leur email professionnel et leur mot de passe.
- Si un utilisateur non-patient tente de se connecter avec un telephone, le backend renvoie une erreur.
- Les tokens ne sont envoyes aux utilisateurs non-patients qu'apres verification OTP.

A stocker cote frontend:

- `accessToken`
- `refreshToken`
- utilisateur via `GET /auth/me`

### POST `/auth/verify-otp`

Body:

```json
{
  "email": "agent@structure.com",
  "code": "123456"
}
```

Reponse attendue si le code est correct:

```json
{
  "success": true,
  "data": {
    "accessToken": "...",
    "refreshToken": "..."
  }
}
```

Messages d'erreur importants a afficher:

```text
Code OTP incorrect. Il vous reste 4 tentative(s)
Code OTP incorrect. Nombre maximum de tentatives atteint. Veuillez relancer la connexion
Code OTP expire. Veuillez relancer la connexion
Aucun code OTP actif. Veuillez relancer la connexion
```

### POST `/auth/refresh`

Body:

```json
{
  "refreshToken": "..."
}
```

### PUT `/auth/change-password`

Body:

```json
{
  "ancienMotDePasse": "ancien",
  "nouveauMotDePasse": "nouveau123"
}
```

`ancienMotDePasse` peut etre absent si le backend force un changement initial.

### PUT `/auth/profile`

Body:

```json
{
  "prenom": "Mamadou",
  "nom": "Diallo",
  "email": "mamadou@example.com",
  "telephone": "622000000"
}
```

## 2. Patients

Prefixe:

```text
/patients
```

| Methode | Endpoint | Auth | Roles | Usage frontend |
|---|---|---:|---|---|
| POST | `/patients` | Non | Public | Creation compte patient complet |
| GET | `/patients/me` | Oui | PATIENT | Profil patient connecte |
| PUT | `/patients/me` | Oui | PATIENT | Modifier profil patient |
| PUT | `/patients/me/structure` | Oui | PATIENT | Choisir structure preferee |
| GET | `/patients/me/export` | Oui | PATIENT | Export dossier patient |
| GET | `/patients` | Oui | ASC, ASC_SUPERVISOR, MEDECIN, ADMIN_STRUCTURE | Liste patients selon perimetre |
| GET | `/patients/qr/:qrCode` | Oui | ASC, ASC_SUPERVISOR, MEDECIN | Rechercher patient par QR |
| GET | `/patients/:id` | Oui | ASC, ASC_SUPERVISOR, MEDECIN, ADMIN_STRUCTURE | Detail patient |

### POST `/patients`

Body:

```json
{
  "telephone": "622000000",
  "motDePasse": "secret123",
  "prenom": "Fatoumata",
  "nom": "Camara",
  "dateNaissance": "1995-06-15",
  "sexe": "F",
  "prefecture": "Conakry",
  "sousPrefecture": "Matam",
  "village": "Kipe",
  "groupeSanguin": "O+",
  "allergies": ["Penicilline"],
  "maladiesChroniques": ["Diabete"],
  "urgenceNom": "Ibrahima Camara",
  "urgenceTelephone": "622111111"
}
```

Important frontend:

- Le backend genere automatiquement `qrCode`.
- La reponse contient les tokens et le profil patient.

### GET `/patients/me`

Utiliser pour:

- Dashboard patient
- Profil patient
- Page QR code patient
- Recuperer `qrCode`

### PUT `/patients/me`

Body:

```json
{
  "prenom": "Fatoumata",
  "nom": "Camara",
  "email": "fatou@example.com",
  "langue": "fr",
  "photoUrl": "https://example.com/photo.png",
  "groupeSanguin": "O+",
  "allergies": ["Penicilline"],
  "maladiesChroniques": ["Diabete"],
  "sousPrefecture": "Matam",
  "village": "Kipe",
  "urgenceNom": "Ibrahima",
  "urgenceTelephone": "622111111"
}
```

### PUT `/patients/me/structure`

Body:

```json
{
  "idStructure": "structure_id"
}
```

Pour supprimer la structure preferee:

```json
{
  "idStructure": null
}
```

### GET `/patients`

Query optionnelle:

```text
?page=1&limit=20&prefecture=Conakry&search=Diallo
```

Important:

- Le backend filtre automatiquement selon le perimetre de l'utilisateur connecte.
- Ne pas afficher comme une liste globale si le role ne le permet pas.

## 3. QR code patient

Le QR code est deja gere par le backend.

Champ:

```text
patient.qrCode
```

Generation:

- Backend: `qrCode String @unique @default(cuid())`
- Frontend: convertir `qrCode` en image avec la librairie `qrcode`

Routes a utiliser:

| Methode | Endpoint | Role | Usage |
|---|---|---|---|
| GET | `/patients/me` | PATIENT | Recuperer le `qrCode` du patient connecte |
| GET | `/patients/qr/:qrCode` | ASC, MEDECIN | Recherche patient par QR |
| GET | `/pharmacien/scan/:qrCode` | PHARMACIEN | Scanner patient pour ordonnances pharmacie |

## 4. Consultations

Prefixe:

```text
/consultations
```

| Methode | Endpoint | Roles | Usage frontend |
|---|---|---|---|
| GET | `/consultations` | ASC, ASC_SUPERVISOR, MEDECIN, ADMIN_STRUCTURE | Liste consultations |
| POST | `/consultations` | ASC, ASC_SUPERVISOR | Ouvrir consultation |
| GET | `/consultations/:id` | ASC, ASC_SUPERVISOR, MEDECIN, ADMIN_STRUCTURE | Detail consultation |
| PUT | `/consultations/:id` | ASC, ASC_SUPERVISOR | Modifier consultation |
| POST | `/consultations/:id/vitals` | ASC, ASC_SUPERVISOR | Saisir constantes |
| POST | `/consultations/:id/complete` | ASC, ASC_SUPERVISOR | Cloturer consultation |
| GET | `/consultations/:id/diagnostics` | ASC, ASC_SUPERVISOR, MEDECIN | Diagnostics |
| POST | `/consultations/:id/diagnostics` | ASC, ASC_SUPERVISOR, MEDECIN | Ajouter diagnostic |
| POST | `/consultations/:id/ordonnances` | ASC, ASC_SUPERVISOR, MEDECIN | Ajouter ordonnance |
| POST | `/consultations/:id/referral` | ASC, ASC_SUPERVISOR | Referer patient |

### GET `/consultations`

Query optionnelle:

```text
?page=1&limit=20&idPatient=...&idAsc=...&statut=EN_COURS
```

Statuts possibles:

```text
PLANIFIEE
EN_COURS
TERMINEE
ANNULEE
REFERENCEE
```

### POST `/consultations`

Body:

```json
{
  "idPatient": "patient_id",
  "motifPrincipal": "Fievre et maux de tete",
  "symptomes": ["Fievre", "Cephalees", "Frissons"]
}
```

### PUT `/consultations/:id`

Body:

```json
{
  "motifPrincipal": "Fievre persistante",
  "symptomes": ["Fievre", "Vomissements"],
  "notesAsc": "Patient stable",
  "protocoleUtilise": "PALU_V1",
  "confianceIa": 0.82
}
```

### POST `/consultations/:id/vitals`

Body:

```json
{
  "temperature": 38.5,
  "poidsKg": 65,
  "tailleCm": 170,
  "perimetreBrachial": 25,
  "tensionSystolique": 120,
  "tensionDiastolique": 80,
  "frequenceCardiaque": 75,
  "frequenceRespiratoire": 18,
  "spo2": 98,
  "glycemie": 1.1
}
```

### POST `/consultations/:id/diagnostics`

Body:

```json
{
  "libelle": "Paludisme simple",
  "codeIcd11": "1F40",
  "typeDiagnostic": "PRINCIPAL",
  "severite": "MODERE",
  "source": "ASC"
}
```

Valeurs:

```text
typeDiagnostic: PRINCIPAL | DIFFERENTIEL | SECONDAIRE
severite: LEGER | MODERE | SEVERE | CRITIQUE
source: IA_LOCALE | IA_CLAUDE | MEDECIN | ASC
```

### POST `/consultations/:id/ordonnances`

Body:

```json
{
  "idMedicament": "medicament_id",
  "posologie": "1 comprime matin et soir",
  "frequence": "2 fois par jour",
  "dureeJours": 7,
  "quantite": 14,
  "instructions": "Apres repas"
}
```

### POST `/consultations/:id/referral`

Body:

```json
{
  "idStructureCible": "structure_id",
  "urgence": "URGENT",
  "resumeClinique": "Patient avec signes necessitant une prise en charge."
}
```

Urgence:

```text
ROUTINE | URGENT | URGENCE_VITALE
```

## 5. ASC

Prefixe:

```text
/asc
```

Toutes les routes exigent:

```text
ASC ou ASC_SUPERVISOR
```

| Methode | Endpoint | Usage frontend |
|---|---|---|
| GET | `/asc/me` | Profil ASC |
| PUT | `/asc/me` | Modifier profil ASC |
| GET | `/asc/patients` | Patients de la zone |
| GET | `/asc/planning` | Planning ASC |
| GET | `/asc/stocks` | Stocks ASC |
| POST | `/asc/stocks` | Creer stock ASC |
| PUT | `/asc/stocks/:id` | Modifier stock ASC |
| GET | `/asc/rapport` | Rapport mensuel ASC |

Notes frontend:

- Les routes ASC n'ont pas encore de validation Zod stricte dans `routes/asc.routes.ts`.
- Gerer les formulaires avec les champs reels retournes par le backend.

## 6. Medecin

Prefixe:

```text
/medecin
```

Roles:

```text
MEDECIN
ADMIN_STRUCTURE
ADMIN_REGIONAL
```

| Methode | Endpoint | Usage frontend |
|---|---|---|
| GET | `/medecin/me` | Profil medecin |
| GET | `/medecin/dashboard` | Dashboard medecin |
| GET | `/medecin/consultations` | Consultations a valider |
| PUT | `/medecin/consultations/:id/valider` | Valider consultation |
| GET | `/medecin/referencements` | Liste referencements |
| PUT | `/medecin/referencements/:id/repondre` | Accepter/refuser referencement |
| GET | `/medecin/messages` | Messagerie |
| POST | `/medecin/messages` | Envoyer message |

Notes frontend:

- Ces routes n'ont pas encore de validation Zod dans le routeur.
- Prevoir affichage d'erreur `400` ou `500` selon reponse backend.

## 7. Pharmacie / Pharmacien

Prefixe:

```text
/pharmacien
```

Toutes les routes exigent:

```text
PHARMACIEN
```

| Methode | Endpoint | Usage frontend |
|---|---|---|
| GET | `/pharmacien/scan/:qrCode` | Scanner QR patient |
| POST | `/pharmacien/ordonnances/:id/delivrer` | Delivrer ordonnance |
| GET | `/pharmacien/stocks` | Stocks pharmacie |
| POST | `/pharmacien/stocks/reapprovisionner` | Ajouter stock pharmacie |
| GET | `/pharmacien/ordonnances` | Ordonnances pharmacie |
| GET | `/pharmacien/medicaments` | Liste medicaments |
| GET | `/pharmacien/agents` | Agents pharmacie |
| POST | `/pharmacien/agents` | Creer agent pharmacien |

### GET `/pharmacien/scan/:qrCode`

Usage:

- Saisie ou scan du QR patient.
- Retourne le patient et ses ordonnances en attente selon backend.

### POST `/pharmacien/ordonnances/:id/delivrer`

Body:

```json
{
  "modePaiement": "ORANGE_MONEY"
}
```

`modePaiement` optionnel:

```text
ESPECES | ORANGE_MONEY | MTN_MOMO
```

### POST `/pharmacien/stocks/reapprovisionner`

Body:

```json
{
  "idMedicament": "medicament_id",
  "quantiteAjoutee": 100,
  "unite": "boite",
  "datePeremption": "2027-12-31",
  "margeGnf": 500
}
```

### POST `/pharmacien/agents`

Body:

```json
{
  "telephone": "622333333",
  "email": "agent@pharmacie.com",
  "motDePasse": "secret123",
  "prenom": "Aissatou",
  "nom": "Bah"
}
```

Important:

- Seul le pharmacien responsable peut creer des agents.

## 8. Admin structure / Super admin

Prefixe:

```text
/admin-structure
```

| Methode | Endpoint | Auth | Roles | Usage frontend |
|---|---|---:|---|---|
| GET | `/admin-structure/structures/publiques` | Non | Public | Liste structures publiques pour patient |
| GET | `/admin-structure/agents` | Oui | ADMIN_STRUCTURE | Liste agents structure |
| POST | `/admin-structure/agents` | Oui | ADMIN_STRUCTURE | Creer agent structure |
| PUT | `/admin-structure/agents/:id/desactiver` | Oui | ADMIN_STRUCTURE | Desactiver agent |
| GET | `/admin-structure/stats` | Oui | ADMIN_STRUCTURE | Stats structure |
| GET | `/admin-structure/structures` | Oui | SUPER_ADMIN, ADMIN_NATIONAL | Liste structures |
| POST | `/admin-structure/structures` | Oui | SUPER_ADMIN | Creer structure + admin |
| POST | `/admin-structure/pharmacies` | Oui | SUPER_ADMIN | Creer pharmacie + pharmacien responsable |
| PUT | `/admin-structure/structures/:id` | Oui | SUPER_ADMIN | Modifier structure |
| DELETE | `/admin-structure/structures/:id` | Oui | SUPER_ADMIN | Desactiver structure |

### POST `/admin-structure/agents`

Body:

```json
{
  "telephone": "622444444",
  "email": "agent@example.com",
  "motDePasse": "secret123",
  "prenom": "Mariama",
  "nom": "Diallo",
  "role": "ASC"
}
```

Role agent:

```text
ASC | ASC_SUPERVISOR | MEDECIN | PHARMACIEN
```

### POST `/admin-structure/structures`

Body:

```json
{
  "nom": "Centre de sante Matam",
  "type": "CENTRE",
  "prefecture": "Conakry",
  "adresse": "Matam",
  "latitude": 9.6412,
  "longitude": -13.5784,
  "telephone": "622555555",
  "admin": {
    "prenom": "Admin",
    "nom": "Structure",
    "telephone": "622666666",
    "email": "admin@structure.com"
  }
}
```

Types:

```text
POSTE | CENTRE | HOPITAL_PREF | HOPITAL_REG | CHU | CLINIQUE
```

### POST `/admin-structure/pharmacies`

Body:

```json
{
  "nom": "Pharmacie Centrale",
  "prefecture": "Conakry",
  "adresse": "Kaloum",
  "latitude": 9.509,
  "longitude": -13.712,
  "telephone": "622777777",
  "pharmacien": {
    "prenom": "Pharma",
    "nom": "Responsable",
    "telephone": "622888888",
    "email": "pharma@example.com",
    "motDePasse": "secret123"
  }
}
```

Important:

- Pour une pharmacie, le backend cree directement un compte `PHARMACIEN` responsable.
- Il ne cree pas `ADMIN_STRUCTURE` pour une pharmacie privee.

## 9. Paiements simules

Prefixe:

```text
/paiements
```

Toutes les routes exigent authentification.

| Methode | Endpoint | Roles | Usage frontend |
|---|---|---|---|
| POST | `/paiements` | PATIENT | Initier paiement simule |
| GET | `/paiements/historique` | PATIENT | Historique patient |
| GET | `/paiements/:id/statut` | PATIENT | Statut facture |
| POST | `/paiements/:id/annuler` | PATIENT | Annuler paiement |
| POST | `/paiements/:id/confirmer` | ADMIN_STRUCTURE, ADMIN_REGIONAL, PHARMACIEN | Confirmer paiement |

### POST `/paiements`

Body:

```json
{
  "idConsultation": "consultation_id",
  "montantGnf": 50000,
  "modePaiement": "ORANGE_MONEY",
  "numeroOperateur": "622000000"
}
```

Modes:

```text
ORANGE_MONEY | MTN_MOMO | ESPECES
```

Important:

- Orange Money et MTN MoMo sont simules.
- Pour `ORANGE_MONEY` et `MTN_MOMO`, `numeroOperateur` est requis.
- Aucun vrai appel API operateur n'est fait.

### POST `/paiements/:id/confirmer`

Body:

```json
{
  "referenceOperateur": "OM-SIM-..."
}
```

## 10. Vaccinations

Prefixe:

```text
/vaccinations
```

| Methode | Endpoint | Roles | Usage frontend |
|---|---|---|
| GET | `/vaccinations/me` | PATIENT | Mon carnet vaccinal |
| POST | `/vaccinations` | ASC, ASC_SUPERVISOR, MEDECIN | Administrer vaccin |
| GET | `/vaccinations/rappels` | ASC, ASC_SUPERVISOR, MEDECIN, ADMIN_STRUCTURE | Rappels vaccins |
| GET | `/vaccinations/stats` | ASC_SUPERVISOR, MEDECIN, ADMIN_STRUCTURE, ADMIN_REGIONAL, ADMIN_NATIONAL | Stats vaccinales |
| GET | `/vaccinations/patient/:id` | ASC, ASC_SUPERVISOR, MEDECIN | Carnet patient |
| PUT | `/vaccinations/:id` | ASC, ASC_SUPERVISOR, MEDECIN | Modifier vaccination |

### POST `/vaccinations`

Body attendu par service:

```json
{
  "idPatient": "patient_id",
  "vaccinNom": "BCG",
  "codeEpi": "BCG",
  "numeroLot": "LOT-001",
  "siteInjection": "Bras gauche",
  "reaction": "Aucune",
  "dateProchaineD": "2027-01-15"
}
```

### GET `/vaccinations/rappels`

Query:

```text
?joursAvant=7&prefecture=Conakry
```

### GET `/vaccinations/stats`

Query:

```text
?prefecture=Conakry
```

## 11. Analytics / Admin dashboard

Prefixe:

```text
/analytics
```

Routes protegees.

Roles principaux:

```text
MEDECIN
ASC_SUPERVISOR
ADMIN_STRUCTURE
ADMIN_REGIONAL
ADMIN_NATIONAL
SUPER_ADMIN
```

| Methode | Endpoint | Usage frontend |
|---|---|---|
| GET | `/analytics/dashboard` | KPIs globaux |
| GET | `/analytics/heatmap` | Donnees cartographiques |
| GET | `/analytics/alertes` | Alertes epidemiques |
| GET | `/analytics/vaccinations/couverture` | Couverture vaccinale |
| GET | `/analytics/tendances` | Tendances temporelles |
| GET | `/analytics/export` | Export JSON, CSV, DHIS2 |

Queries communes:

```text
?prefecture=Conakry&debut=2026-01-01&fin=2026-12-31
```

### GET `/analytics/heatmap`

Query:

```text
?pathologie=Paludisme&debut=2026-01-01&fin=2026-12-31
```

### GET `/analytics/export`

Query:

```text
?format=JSON
?format=CSV
?format=DHIS2
```

Important:

- Si `format=CSV`, le frontend doit traiter une reponse `text/csv`.
- Sinon reponse JSON.

## 12. Notifications

Prefixe:

```text
/notifications
```

Toutes les routes exigent authentification.

| Methode | Endpoint | Roles | Usage frontend |
|---|---|---|---|
| POST | `/notifications/sms` | ADMIN_STRUCTURE, ADMIN_REGIONAL, ADMIN_NATIONAL, SUPER_ADMIN | SMS manuel |
| POST | `/notifications/sms/masse` | ADMIN_REGIONAL, ADMIN_NATIONAL, SUPER_ADMIN | SMS masse |
| POST | `/notifications/rappel/rendez-vous/:id` | ASC, ASC_SUPERVISOR | Envoyer rappel RDV |
| POST | `/notifications/rappel/vaccination/:id` | ASC, ASC_SUPERVISOR, MEDECIN | Envoyer rappel vaccin |
| POST | `/notifications/alerte/stock/:id` | ASC, ASC_SUPERVISOR | Alerte stock |
| POST | `/notifications/referencement/:id` | MEDECIN, ADMIN_STRUCTURE | Notification referencement |
| GET | `/notifications/rappels/verifier` | ADMIN_STRUCTURE, ADMIN_REGIONAL, ADMIN_NATIONAL, SUPER_ADMIN | Verifier rappels a envoyer |

Notes:

- Les SMS sont simules dans le backend.
- Pas de vraie API SMS branchee pour l'instant.

## 13. Sync offline

Prefixe:

```text
/sync
```

Roles:

```text
PATIENT
ASC
ASC_SUPERVISOR
MEDECIN
PHARMACIEN
ADMIN_STRUCTURE
```

| Methode | Endpoint | Usage frontend/mobile |
|---|---|---|
| GET | `/sync/changes` | Pull changements serveur |
| POST | `/sync/push` | Push mutations offline |

### GET `/sync/changes`

Query:

```text
?since=2026-06-06T00:00:00.000Z&limit=100&scope=medical
```

### POST `/sync/push`

Body:

```json
{
  "mutations": [
    {
      "clientMutationId": "device-001-mut-0001",
      "deviceId": "device-001",
      "entityType": "Consultation",
      "entityId": "optional_id",
      "operation": "CREATE",
      "payload": {
        "idPatient": "patient_id",
        "motifPrincipal": "Fievre",
        "symptomes": ["Fievre"]
      },
      "baseVersion": 1
    }
  ]
}
```

Operations:

```text
CREATE | UPDATE | DELETE
```

Ressources supportees par le traitement backend MVP:

```text
PatientProfile
Consultation
ConstantesVitales
Vaccination
Stock
```

Important:

- `DELETE` est refuse pour les donnees medicales.
- Le backend retourne les mutations avec statut `TRAITE` ou `REJETE`.

## 14. FHIR

Prefixe:

```text
/fhir
```

Roles:

```text
PATIENT
ASC
ASC_SUPERVISOR
MEDECIN
ADMIN_STRUCTURE
ADMIN_REGIONAL
ADMIN_NATIONAL
SUPER_ADMIN
```

| Methode | Endpoint | Usage frontend |
|---|---|---|
| GET | `/fhir/patients/:id` | Export Patient FHIR |
| GET | `/fhir/patients/:id/bundle` | Export dossier FHIR |
| GET | `/fhir/consultations/:id` | Export Encounter FHIR |

Important:

- Pour exporter le dossier FHIR d'un autre patient, le consentement `FHIR_EXPORT` est requis.
- Le patient peut exporter son propre dossier.

## 15. Confidentialite / Consentement

Prefixe:

```text
/privacy
```

Role:

```text
PATIENT
```

| Methode | Endpoint | Usage frontend |
|---|---|---|
| GET | `/privacy/me/consents` | Mes consentements |
| PUT | `/privacy/me/consents` | Donner/retirer consentement |
| GET | `/privacy/me/audit-logs` | Voir acces a mon dossier |

### PUT `/privacy/me/consents`

Body:

```json
{
  "scope": "FHIR_EXPORT",
  "actif": true,
  "source": "WEB",
  "commentaire": "J'autorise l'export FHIR."
}
```

Scopes:

```text
DOSSIER_MEDICAL
FHIR_EXPORT
RAPPELS_SMS
RECHERCHE_ANONYMISEE
```

## 16. Triage ASC

Prefixe:

```text
/triage
```

Roles:

```text
ASC
ASC_SUPERVISOR
MEDECIN
```

| Methode | Endpoint | Usage frontend |
|---|---|---|
| POST | `/triage/evaluer` | Evaluer symptomes et constantes |

Body:

```json
{
  "ageAnnees": 28,
  "symptomes": ["fievre", "frissons", "cephalee"],
  "constantes": {
    "temperature": 39.5,
    "spo2": 96,
    "frequenceRespiratoire": 22,
    "frequenceCardiaque": 90,
    "tensionSystolique": 120,
    "glycemie": 1.1
  }
}
```

Reponse:

```json
{
  "success": true,
  "data": {
    "moteur": "REGLES_ASC_V1",
    "urgence": "URGENT",
    "alertes": [],
    "hypotheses": [],
    "recommandation": "...",
    "avertissement": "Outil d aide a la decision. Ne remplace pas le jugement clinique."
  }
}
```

## 17. USSD

Prefixe:

```text
/ussd
```

| Methode | Endpoint | Auth | Usage |
|---|---|---:|---|
| POST | `/ussd/session` | Non | Callback USSD agregateur |

Body:

```json
{
  "sessionId": "ussd-session-001",
  "phoneNumber": "622000000",
  "text": "1"
}
```

Reponse:

```text
CON BaoBaoHealth...
```

ou:

```text
END Merci...
```

Important frontend:

- Cette route est surtout pour l'integration avec un agregateur USSD.
- Elle n'est pas destinee a l'interface Angular classique, sauf pour tester.

## 18. Ordre recommande d'integration frontend

### Phase 1 - Socle

1. Auth: login, refresh, logout, me.
2. Guard roles frontend.
3. Interceptor `Authorization: Bearer`.
4. Gestion erreurs `401`, `403`, `400`.

### Phase 2 - Patient

1. Profil patient.
2. QR code patient.
3. Carnet vaccinal patient.
4. Paiements simules.
5. Consentements et audit logs.

### Phase 3 - ASC

1. Liste patients.
2. Recherche par QR.
3. Creation consultation.
4. Constantes vitales.
5. Diagnostics.
6. Ordonnances.
7. Referencement.
8. Triage.
9. Sync offline.

### Phase 4 - Medecin

1. Dashboard medecin.
2. Consultations a valider.
3. Referencements.
4. Messagerie.
5. Exports FHIR si besoin.

### Phase 5 - Pharmacie

1. Scanner QR patient.
2. Voir ordonnances.
3. Delivrer ordonnance.
4. Stocks pharmacie.
5. Agents pharmacie.

### Phase 6 - Admin

1. Structures publiques.
2. Gestion structures.
3. Creation pharmacie.
4. Agents structure.
5. Analytics.
6. Exports JSON/CSV/DHIS2.
7. Notifications simulees.

## 19. Points importants pour le frontend

### Tokens

- Toujours stocker `accessToken` et `refreshToken`.
- Si `401`, tenter `/auth/refresh`.
- Si refresh echoue, deconnecter.

### Roles

- Le backend bloque deja les roles.
- Le frontend doit cacher les menus non autorises.

### QR code

- Ne pas demander au backend une image QR.
- Le backend donne la valeur `qrCode`.
- Le frontend genere l'image QR localement.

### Paiements

- Tous les paiements mobile money sont simules.
- Ne pas afficher "paiement reel confirme par operateur".
- Afficher plutot "simulation de paiement".

### Offline

- Pour Angular web classique, `sync` peut etre ignore au debut.
- Pour app terrain/mobile, utiliser `/sync/changes` et `/sync/push`.

### FHIR

- A integrer surtout dans admin/medecin/export.
- Prevoir message si consentement patient manquant.

### PostgreSQL Docker

- Backend local utilise PostgreSQL BaoBaoHealth sur `5433`.
- Cela ne change rien pour le frontend.

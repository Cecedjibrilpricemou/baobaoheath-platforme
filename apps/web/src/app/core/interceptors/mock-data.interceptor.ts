// core/interceptors/mock-data.interceptor.ts
// ─────────────────────────────────────────────────────────────────────────────
// Intercepteur de données de test — actif quand MOCK_ENABLED = true
// Permet de tester toutes les interfaces sans backend
// Basculer à false pour utiliser l'API réelle
// ─────────────────────────────────────────────────────────────────────────────

import { isDevMode } from '@angular/core';
import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { of } from 'rxjs';

export const MOCK_ENABLED = isDevMode();

// ─── Helpers temporels ───────────────────────────────────────────────────────
const ago  = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();
const next = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();
function ok<T>(data: T) {
  return of(new HttpResponse({ status: 200, body: { success: true, data } }));
}
function paginated<T>(items: T[], total?: number) {
  return ok({ items, total: total ?? items.length, page: 1, limit: 100 });
}

// ─── Données de référence ────────────────────────────────────────────────────

const STRUCTURES = [
  { id: 's1', nom: 'CHU Donka',                    type: 'CHU',          prefecture: 'Conakry', region: 'Conakry' },
  { id: 's2', nom: 'Hôpital Ignace Deen',           type: 'HOPITAL_REG',  prefecture: 'Conakry', region: 'Conakry' },
  { id: 's3', nom: 'Centre de Santé de Ratoma',     type: 'CENTRE',       prefecture: 'Conakry', region: 'Conakry' },
  { id: 's4', nom: 'Poste de Santé de Bambeto',     type: 'POSTE',        prefecture: 'Conakry', region: 'Conakry' },
  { id: 's5', nom: 'Centre Médical de Kindia',      type: 'CENTRE',       prefecture: 'Kindia',  region: 'Kindia'  },
  { id: 's6', nom: 'Hôpital Régional de Labé',      type: 'HOPITAL_REG',  prefecture: 'Labé',    region: 'Labé'    },
  { id: 's7', nom: 'Pharmacie Centrale de Guinée',  type: 'PHARMACIE',    prefecture: 'Conakry', region: 'Conakry' },
];

const MEDICAMENTS = [
  { id: 'm1', dci: 'Paracétamol',               nomCommercial: 'Doliprane',   forme: 'Comprimé', dosage: '500mg',       prixUnitaireGnf: 500,   categorie: 'Antalgique'       },
  { id: 'm2', dci: 'Artémether/Luméfantrine',   nomCommercial: 'Coartem',     forme: 'Comprimé', dosage: '20/120mg',    prixUnitaireGnf: 15000,  categorie: 'Antipaludique'   },
  { id: 'm3', dci: 'Amoxicilline',              nomCommercial: null,          forme: 'Gélule',   dosage: '250mg',       prixUnitaireGnf: 800,   categorie: 'Antibiotique'     },
  { id: 'm4', dci: 'Cotrimoxazole',             nomCommercial: null,          forme: 'Comprimé', dosage: '960mg',       prixUnitaireGnf: 600,   categorie: 'Antibiotique'     },
  { id: 'm5', dci: 'Ibuprofène',                nomCommercial: 'Advil',       forme: 'Comprimé', dosage: '400mg',       prixUnitaireGnf: 700,   categorie: 'Anti-inflammatoire'},
  { id: 'm6', dci: 'Sels de Réhydratation Orale', nomCommercial: 'ORS-L',    forme: 'Sachet',   dosage: '27.9g',       prixUnitaireGnf: 1000,  categorie: 'Rééquilibrant hydrique' },
  { id: 'm7', dci: 'Métronidazole',             nomCommercial: null,          forme: 'Comprimé', dosage: '500mg',       prixUnitaireGnf: 750,   categorie: 'Antibiotique'     },
  { id: 'm8', dci: 'Albendazole',               nomCommercial: 'Zentel',      forme: 'Comprimé', dosage: '400mg',       prixUnitaireGnf: 2000,  categorie: 'Antiparasitaire'  },
  { id: 'm9', dci: 'Vitamine A',                nomCommercial: null,          forme: 'Capsule',  dosage: '100 000 UI',  prixUnitaireGnf: 500,   categorie: 'Vitamines'        },
  { id: 'm10', dci: 'Fer + Acide Folique',      nomCommercial: 'Ferrograd',   forme: 'Comprimé', dosage: '200/0.4mg',   prixUnitaireGnf: 300,   categorie: 'Antianémique'     },
];

const PATIENTS = [
  {
    id: 'p1', qrCode: 'BBH-MADI-2026', dateNaissance: '1992-05-15', sexe: 'M',
    groupeSanguin: 'O+', allergies: ['Pénicilline'], adresse: 'Ratoma, Conakry',
    utilisateur: { id: 'u1', prenom: 'Mamadou', nom: 'Diallo', telephone: '620 00 01 01', email: 'mamadou@test.gn', photoUrl: null }
  },
  {
    id: 'p2', qrCode: 'BBH-FACA-2026', dateNaissance: '1998-11-22', sexe: 'F',
    groupeSanguin: 'A+', allergies: [], adresse: 'Kaloum, Conakry',
    utilisateur: { id: 'u2', prenom: 'Fatoumata', nom: 'Camara', telephone: '622 00 02 02', email: null, photoUrl: null }
  },
  {
    id: 'p3', qrCode: 'BBH-IBKO-2026', dateNaissance: '2018-03-10', sexe: 'M',
    groupeSanguin: 'B+', allergies: ['Aspirine'], adresse: 'Matam, Conakry',
    utilisateur: { id: 'u3', prenom: 'Ibrahim', nom: 'Kouyaté', telephone: '628 00 03 03', email: null, photoUrl: null }
  },
  {
    id: 'p4', qrCode: 'BBH-AIBA-2026', dateNaissance: '1975-07-08', sexe: 'F',
    groupeSanguin: 'AB+', allergies: [], adresse: 'Dixinn, Conakry',
    utilisateur: { id: 'u4', prenom: 'Aissatou', nom: 'Bah', telephone: '625 00 04 04', email: null, photoUrl: null }
  },
  {
    id: 'p5', qrCode: 'BBH-SEBA-2026', dateNaissance: '2020-01-30', sexe: 'M',
    groupeSanguin: 'O-', allergies: [], adresse: 'Matoto, Conakry',
    utilisateur: { id: 'u5', prenom: 'Seydou', nom: 'Barry', telephone: '626 00 05 05', email: null, photoUrl: null }
  },
  {
    id: 'p6', qrCode: 'BBH-MACI-2026', dateNaissance: '1985-09-14', sexe: 'F',
    groupeSanguin: 'A-', allergies: ['Sulfamides'], adresse: 'Labé',
    utilisateur: { id: 'u6', prenom: 'Mariama', nom: 'Cissé', telephone: '621 00 06 06', email: null, photoUrl: null }
  },
];

const VITALS_NORMAL = {
  id: 'v1', temperature: 37.2, poidsKg: 68, tailleCm: 172,
  frequenceCardiaque: 76, tensionSystolique: 122, tensionDiastolique: 78,
  spo2: 98, frequenceRespiratoire: 16, glycemie: 0.92, alertes: []
};

const CONSULTATIONS = [
  {
    id: 'c1', statut: 'EN_COURS', motifPrincipal: 'Fièvre persistante depuis 3 jours',
    symptomes: ['fièvre', 'frissons', 'céphalées'], consulteeLE: ago(0),
    patient: PATIENTS[0],
    constantes: { id: 'v2', temperature: 38.9, poidsKg: 68, tailleCm: 172, frequenceCardiaque: 98, tensionSystolique: 118, tensionDiastolique: 76, spo2: 97, frequenceRespiratoire: 20, perimetreBrachial: null, glycemie: null, alertes: ['Fièvre élevée (≥ 38.5°C)'] },
    diagnostics: [],
    ordonnances: [],
    referencement: null
  },
  {
    id: 'c2', statut: 'TERMINEE', motifPrincipal: 'Diarrhée aiguë — enfant 4 ans',
    symptomes: ['diarrhée', 'vomissements', 'déshydratation légère'], consulteeLE: ago(2),
    patient: PATIENTS[2],
    constantes: { id: 'v3', temperature: 37.9, poidsKg: 14, tailleCm: 98, perimetreBrachial: 13.2, frequenceCardiaque: 112, tensionSystolique: 95, tensionDiastolique: 65, spo2: 99, frequenceRespiratoire: 24, glycemie: null, alertes: [] },
    diagnostics: [
      { id: 'd1', libelle: 'Diarrhée aiguë infectieuse', codeIcd11: 'A08', typeDiagnostic: 'PRINCIPAL', severite: 'MODEREE', statutClinique: 'RESOLU', source: 'ASC', creeLe: ago(2) }
    ],
    ordonnances: [
      { id: 'o1', posologie: '1 sachet', frequence: '3x/jour', dureeJours: 3, instructions: 'Dissoudre dans 200 ml d\'eau propre', statut: 'DELIVREE', medicament: MEDICAMENTS[5] }
    ],
    referencement: null
  },
  {
    id: 'c3', statut: 'REFERENCEE', motifPrincipal: 'Malnutrition aiguë sévère — nourrisson 18 mois',
    symptomes: ['perte de poids sévère', 'PB < 11.5 cm', 'oedèmes bilatéraux', 'apathie'], consulteeLE: ago(1),
    patient: PATIENTS[4],
    constantes: { id: 'v4', temperature: 36.5, poidsKg: 5.2, tailleCm: 64, perimetreBrachial: 10.8, frequenceCardiaque: 132, tensionSystolique: 72, tensionDiastolique: 48, spo2: 94, frequenceRespiratoire: 32, glycemie: 0.48, alertes: ['Malnutrition aiguë sévère (PB < 11.5 cm)', 'Hypoglycémie (< 0.5 g/L) — urgent', 'Tachycardie (> 100 bpm)', 'Tachypnée sévère (> 30/min)'] },
    diagnostics: [
      { id: 'd2', libelle: 'Malnutrition aiguë sévère avec complications', codeIcd11: '5B70', typeDiagnostic: 'PRINCIPAL', severite: 'CRITIQUE', statutClinique: 'ACTIF', source: 'ASC', creeLe: ago(1) }
    ],
    ordonnances: [],
    referencement: { id: 'r1', urgence: 'URGENCE_VITALE', statut: 'ACCEPTE', resumeClinique: 'Nourrisson 18 mois MAS confirmée. PB 10.8 cm, oedèmes bilatéraux +2, hypoglycémie 0.48 g/L. Transfert CRENI CHU Donka urgent.', structureCible: STRUCTURES[0] }
  },
  {
    id: 'c4', statut: 'PLANIFIEE', motifPrincipal: 'Suivi tension artérielle — HTA connue',
    symptomes: ['céphalées matinales', 'vertiges'], consulteeLE: next(1),
    patient: PATIENTS[3],
    constantes: null,
    diagnostics: [],
    ordonnances: [],
    referencement: null
  },
  {
    id: 'c5', statut: 'TERMINEE', motifPrincipal: 'Paludisme simple — adulte',
    symptomes: ['fièvre 39°C', 'frissons intenses', 'céphalées', 'arthralgies'], consulteeLE: ago(5),
    patient: PATIENTS[1],
    constantes: { id: 'v5', temperature: 39.3, poidsKg: 58, tailleCm: 162, perimetreBrachial: null, frequenceCardiaque: 108, tensionSystolique: 110, tensionDiastolique: 70, spo2: 97, frequenceRespiratoire: 22, glycemie: 0.85, alertes: ['Fièvre très élevée (≥ 40°C) — risque vital'] },
    diagnostics: [
      { id: 'd3', libelle: 'Paludisme simple', codeIcd11: '1F40', typeDiagnostic: 'PRINCIPAL', severite: 'MODEREE', statutClinique: 'RESOLU', source: 'ASC', creeLe: ago(5) },
      { id: 'd4', libelle: 'Anémie légère associée', codeIcd11: '3A00', typeDiagnostic: 'SECONDAIRE', severite: 'LEGERE', statutClinique: 'EN_SURVEILLANCE', source: 'ASC', creeLe: ago(5) }
    ],
    ordonnances: [
      { id: 'o2', posologie: '4 comprimés', frequence: '2x/jour', dureeJours: 3, instructions: 'Prendre avec un repas riche en lipides', statut: 'DELIVREE', medicament: MEDICAMENTS[1] },
      { id: 'o3', posologie: '2 comprimés', frequence: '3x/jour', dureeJours: 3, instructions: null, statut: 'DELIVREE', medicament: MEDICAMENTS[0] }
    ],
    referencement: null
  },
  {
    id: 'c6', statut: 'EN_COURS', motifPrincipal: 'IRA haute — toux et rhume',
    symptomes: ['toux sèche', 'rhinorrhée', 'légère fièvre'], consulteeLE: ago(0),
    patient: PATIENTS[5],
    constantes: { id: 'v6', temperature: 38.1, poidsKg: 62, tailleCm: 158, perimetreBrachial: null, frequenceCardiaque: 84, tensionSystolique: 118, tensionDiastolique: 74, spo2: 99, frequenceRespiratoire: 17, glycemie: null, alertes: [] },
    diagnostics: [
      { id: 'd5', libelle: 'Infection respiratoire aiguë haute', codeIcd11: 'CA22', typeDiagnostic: 'PRINCIPAL', severite: 'LEGERE', statutClinique: 'ACTIF', source: 'ASC', creeLe: ago(0) }
    ],
    ordonnances: [
      { id: 'o4', posologie: '1 comprimé', frequence: '3x/jour', dureeJours: 5, instructions: 'Prendre avec un verre d\'eau', statut: 'EN_ATTENTE', medicament: MEDICAMENTS[0] }
    ],
    referencement: null
  },
];

const VACCINATIONS = [
  { id: 'vac1', nomVaccin: 'BCG', vaccin: 'BCG', dateAdministration: ago(180), prochainRappel: null, lot: 'BCG-2025-001', structureAdministration: 'Poste de Santé de Bambeto', administrePar: 'Dr. Sow' },
  { id: 'vac2', nomVaccin: 'DTC-HepB-Hib (1re dose)', vaccin: 'Pentavalent D1', dateAdministration: ago(150), prochainRappel: ago(-90), lot: 'PENTA-2025-002', structureAdministration: 'Centre de Santé de Ratoma', administrePar: 'Inf. Diallo' },
  { id: 'vac3', nomVaccin: 'DTC-HepB-Hib (2e dose)', vaccin: 'Pentavalent D2', dateAdministration: ago(120), prochainRappel: ago(-60), lot: 'PENTA-2025-003', structureAdministration: 'Centre de Santé de Ratoma', administrePar: 'Inf. Diallo' },
  { id: 'vac4', nomVaccin: 'DTC-HepB-Hib (3e dose)', vaccin: 'Pentavalent D3', dateAdministration: ago(90), prochainRappel: next(15), lot: 'PENTA-2025-004', structureAdministration: 'Centre de Santé de Ratoma', administrePar: 'Inf. Camara' },
  { id: 'vac5', nomVaccin: 'Vaccin anti-paludique (RTS,S)', vaccin: 'RTS,S D1', dateAdministration: ago(45), prochainRappel: next(30), lot: 'RTSS-2025-001', structureAdministration: 'CHU Donka', administrePar: 'Dr. Barry' },
  { id: 'vac6', nomVaccin: 'Vitamine A', vaccin: 'Vit. A 100k UI', dateAdministration: ago(30), prochainRappel: next(150), lot: 'VITA-2026-001', structureAdministration: 'Poste de Santé de Bambeto', administrePar: 'Inf. Bah' },
];

const ASC_STOCKS = [
  { id: 'st1', quantite: 8,   seuilAlerte: 20, unite: 'comprimés', dateExpiration: next(45),  medicament: MEDICAMENTS[1], categorie: 'Antipaludique'   },
  { id: 'st2', quantite: 150, seuilAlerte: 30, unite: 'comprimés', dateExpiration: next(365), medicament: MEDICAMENTS[0], categorie: 'Antalgique'      },
  { id: 'st3', quantite: 12,  seuilAlerte: 20, unite: 'gélules',   dateExpiration: next(180), medicament: MEDICAMENTS[2], categorie: 'Antibiotique'    },
  { id: 'st4', quantite: 45,  seuilAlerte: 15, unite: 'sachets',   dateExpiration: next(240), medicament: MEDICAMENTS[5], categorie: 'Rééquilibrant'   },
  { id: 'st5', quantite: 3,   seuilAlerte: 10, unite: 'comprimés', dateExpiration: next(90),  medicament: MEDICAMENTS[7], categorie: 'Antiparasitaire' },
  { id: 'st6', quantite: 60,  seuilAlerte: 20, unite: 'comprimés', dateExpiration: next(300), medicament: MEDICAMENTS[9], categorie: 'Antianémique'    },
  { id: 'st7', quantite: 25,  seuilAlerte: 10, unite: 'capsules',  dateExpiration: next(120), medicament: MEDICAMENTS[8], categorie: 'Vitamines'       },
];

const ASC_PLANNING = [
  { id: 'rdv1', date: next(0), motif: 'Suivi malnutrition — pesée mensuelle',      statut: 'PLANIFIE',  patient: PATIENTS[4], structure: STRUCTURES[3] },
  { id: 'rdv2', date: next(0), motif: 'Vaccination RTS,S 2e dose',                  statut: 'CONFIRME',  patient: PATIENTS[0], structure: STRUCTURES[3] },
  { id: 'rdv3', date: next(1), motif: 'Suivi HTA — mesure tension mensuelle',        statut: 'PLANIFIE',  patient: PATIENTS[3], structure: STRUCTURES[3] },
  { id: 'rdv4', date: next(2), motif: 'Consultation post-paludisme',                 statut: 'PLANIFIE',  patient: PATIENTS[1], structure: STRUCTURES[3] },
  { id: 'rdv5', date: next(3), motif: 'Vitamin A supplémentation — nourrisson',      statut: 'PLANIFIE',  patient: PATIENTS[2], structure: STRUCTURES[3] },
  { id: 'rdv6', date: ago(1),  motif: 'Dépistage malnutrition — session mensuelle', statut: 'TERMINE',   patient: PATIENTS[5], structure: STRUCTURES[3] },
];

const MEDECIN_MESSAGES = [
  { id: 'msg1', contenu: 'Merci Dr. Konaté pour le référencement rapide du nourrisson MAS. Admis en CRENI. Évolution favorable.', creeLe: ago(1), lu: false, expediteur: { prenom: 'Infirmier', nom: 'Baldé' }, destinataire: { prenom: 'Dr', nom: 'Konaté' } },
  { id: 'msg2', contenu: 'Patient Mamadou Diallo — paludisme simple traité. TDR négatif à J3. Guérison confirmée.', creeLe: ago(2), lu: true,  expediteur: { prenom: 'Agent', nom: 'Camara' }, destinataire: { prenom: 'Dr', nom: 'Konaté' } },
  { id: 'msg3', contenu: 'Rupture Coartem au Poste de Bambeto — commande urgente nécessaire cette semaine.', creeLe: ago(3), lu: true,  expediteur: { prenom: 'Resp.', nom: 'Stocks' }, destinataire: { prenom: 'Dr', nom: 'Konaté' } },
  { id: 'msg4', contenu: 'Cas suspect choléra — préfecture de Kindia. Alerte transmise DPS. 3 patients hospitalisés.', creeLe: ago(0), lu: false, expediteur: { prenom: 'Superviseur', nom: 'ASC' }, destinataire: { prenom: 'Dr', nom: 'Konaté' } },
];

const PHARMA_STOCKS = [
  { id: 'pst1', quantite: 2400, seuilAlerte: 200, dateExpiration: next(180), medicament: MEDICAMENTS[0] },
  { id: 'pst2', quantite: 360,  seuilAlerte: 50,  dateExpiration: next(90),  medicament: MEDICAMENTS[1] },
  { id: 'pst3', quantite: 800,  seuilAlerte: 100, dateExpiration: next(365), medicament: MEDICAMENTS[2] },
  { id: 'pst4', quantite: 15,   seuilAlerte: 50,  dateExpiration: next(60),  medicament: MEDICAMENTS[3] },
  { id: 'pst5', quantite: 1200, seuilAlerte: 100, dateExpiration: next(240), medicament: MEDICAMENTS[4] },
  { id: 'pst6', quantite: 500,  seuilAlerte: 80,  dateExpiration: next(300), medicament: MEDICAMENTS[5] },
  { id: 'pst7', quantite: 650,  seuilAlerte: 60,  dateExpiration: next(200), medicament: MEDICAMENTS[6] },
  { id: 'pst8', quantite: 90,   seuilAlerte: 40,  dateExpiration: next(150), medicament: MEDICAMENTS[7] },
];

const SCAN_QR_RESULT = {
  patient: {
    prenom: 'Mamadou', nom: 'Diallo',
    dateNaissance: '1992-05-15', groupeSanguin: 'O+',
    allergiesCritiques: ['Pénicilline']
  },
  ordonnances: [
    {
      id: 'ord-scan-1', posologie: '4 comprimés', frequence: '2x/jour',
      dureeJours: 3, quantite: 24, statut: 'EN_ATTENTE',
      signeLe: ago(1), medecinNom: 'Dr. Konaté Ibrahima',
      medicament: MEDICAMENTS[1], prixTotalGnf: 360000, alerteAllergie: false
    },
    {
      id: 'ord-scan-2', posologie: '2 comprimés', frequence: '3x/jour',
      dureeJours: 3, quantite: 18, statut: 'EN_ATTENTE',
      signeLe: ago(1), medecinNom: 'Dr. Konaté Ibrahima',
      medicament: MEDICAMENTS[0], prixTotalGnf: 9000, alerteAllergie: false
    }
  ]
};

const PATIENT_ME = {
  id: 'p1', qrCode: 'BBH-MADI-2026',
  dateNaissance: '1992-05-15', sexe: 'M',
  groupeSanguin: 'O+', allergies: ['Pénicilline'],
  adresse: 'Ratoma, Conakry',
  antecedents: 'Paludisme à répétition (3 épisodes/an). Pas de pathologie chronique connue.',
  structurePrefereeId: 's3',
  utilisateur: { id: 'u1', prenom: 'Mamadou', nom: 'Diallo', telephone: '620 00 01 01', email: 'mamadou@test.gn', photoUrl: null }
};

const MEDECIN_DASHBOARD = {
  consultationsValidees: 48,
  consultationsEnAttente: 7,
  referencementsEnAttente: 3,
  messagesNonLus: 2,
  structure: { nom: 'Centre de Santé de Ratoma', type: 'CENTRE', prefecture: 'Conakry' }
};

const ANALYTICS = {
  totalPatients: 1247,
  totalConsultations: 3892,
  totalVaccinations: 8654,
  tauxCouvertureVaccinale: 78.4,
  consultationsParMois: [
    { mois: 'Jan', count: 312 }, { mois: 'Fév', count: 287 },
    { mois: 'Mar', count: 345 }, { mois: 'Avr', count: 398 },
    { mois: 'Mai', count: 421 }, { mois: 'Jun', count: 389 },
  ],
  topPathologies: [
    { libelle: 'Paludisme simple',      count: 892, pourcentage: 22.9 },
    { libelle: 'IRA haute',             count: 654, pourcentage: 16.8 },
    { libelle: 'Diarrhée aiguë',        count: 487, pourcentage: 12.5 },
    { libelle: 'Malnutrition aiguë',    count: 312, pourcentage: 8.0  },
    { libelle: 'Hypertension artérielle', count: 201, pourcentage: 5.2 },
  ],
  alertesEpidemiques: [
    { pathologie: 'Choléra', prefecture: 'Kindia', niveau: 'ALERTE', casConfirmes: 12, date: ago(2) },
    { pathologie: 'Méningite', prefecture: 'Kankan', niveau: 'ATTENTION', casConfirmes: 4, date: ago(7) },
  ],
  vaccinsParType: [
    { vaccin: 'Pentavalent', administres: 2341, cible: 2800 },
    { vaccin: 'RTS,S',       administres: 876,  cible: 1200 },
    { vaccin: 'BCG',         administres: 1920, cible: 2100 },
    { vaccin: 'Vitamine A',  administres: 3517, cible: 4000 },
  ]
};

// ─── Matching d'URL ──────────────────────────────────────────────────────────
function getPath(fullUrl: string): string {
  try {
    return new URL(fullUrl).pathname.replace('/api/v1', '');
  } catch {
    const match = fullUrl.match(/\/api\/v1(\/.*?)(\?|$)/);
    return match ? match[1] : fullUrl;
  }
}

// ─── Intercepteur ────────────────────────────────────────────────────────────
export const mockDataInterceptor: HttpInterceptorFn = (req, next) => {
  if (!MOCK_ENABLED) return next(req);

  // Ne pas intercepter les appels d'authentification (laisser passer vers le vrai backend)
  if (req.url.includes('/auth/')) return next(req);

  const path  = getPath(req.url);
  const method = req.method;

  // ── Stats publiques ──────────────────────────────────────────────
  if (method === 'GET' && path === '/stats/public')
    return ok({ patients: 1247, consultations: 3892, asc: 48, structures: 12 });

  // ── Structures ───────────────────────────────────────────────────
  if (method === 'GET' && path === '/structures')
    return ok(STRUCTURES);

  // ── Médicaments ──────────────────────────────────────────────────
  if (method === 'GET' && (path === '/medicaments' || path === '/pharmacien/medicaments'))
    return ok(MEDICAMENTS);

  // ── Patient (profil perso) ────────────────────────────────────────
  if (method === 'GET' && path === '/patients/me')
    return ok(PATIENT_ME);

  // ── Liste patients (recherche ASC) ───────────────────────────────
  if (method === 'GET' && path === '/patients')
    return ok(PATIENTS);

  // ── Consultations — liste paginée ────────────────────────────────
  if (method === 'GET' && path === '/consultations')
    return paginated(CONSULTATIONS);

  // ── Consultation — détail par ID ─────────────────────────────────
  if (method === 'GET' && path.startsWith('/consultations/') && !path.includes('/vitals') && !path.includes('/diagnostics') && !path.includes('/ordonnances') && !path.includes('/referral') && !path.includes('/complete')) {
    const id = path.split('/')[2];
    const c  = CONSULTATIONS.find(x => x.id === id) ?? CONSULTATIONS[0];
    return ok(c);
  }

  // ── Consultations patient (pour le dashboard patient) ────────────
  if (method === 'GET' && path === '/patients/me/consultations')
    return paginated(CONSULTATIONS.slice(0, 3).map(c => ({ ...c, date: c.consulteeLE, motif: c.motifPrincipal })));

  // ── Vaccinations patient ─────────────────────────────────────────
  if (method === 'GET' && path === '/vaccinations/me')
    return ok(VACCINATIONS);

  // ── Stocks ASC ───────────────────────────────────────────────────
  if (method === 'GET' && path === '/asc/stocks')
    return ok(ASC_STOCKS);

  // ── Planning ASC ─────────────────────────────────────────────────
  if (method === 'GET' && path === '/asc/planning')
    return ok(ASC_PLANNING);

  // ── Rapport ASC ──────────────────────────────────────────────────
  if (method === 'GET' && path === '/asc/rapport')
    return ok({ totalPatientsSuivis: 87, consultationsSemaine: 23, vaccinsAdministres: 156, alertesStockCritiques: 2 });

  // ── Dashboard médecin ─────────────────────────────────────────────
  if (method === 'GET' && path === '/medecin/dashboard')
    return ok(MEDECIN_DASHBOARD);

  // ── Consultations médecin ─────────────────────────────────────────
  if (method === 'GET' && path === '/medecin/consultations')
    return ok(CONSULTATIONS.filter(c => ['TERMINEE', 'REFERENCEE'].includes(c.statut)));

  // ── Référencements médecin ────────────────────────────────────────
  if (method === 'GET' && path === '/medecin/referencements')
    return paginated(CONSULTATIONS.filter(c => c.referencement).map(c => ({ ...c, referencement: c.referencement })));

  // ── Messages médecin ──────────────────────────────────────────────
  if (method === 'GET' && path === '/medecin/messages')
    return ok(MEDECIN_MESSAGES);

  // ── Scan QR Pharmacien ────────────────────────────────────────────
  if (method === 'GET' && path.startsWith('/pharmacien/scan/'))
    return ok(SCAN_QR_RESULT);

  // ── Stocks pharmacien ─────────────────────────────────────────────
  if (method === 'GET' && path === '/pharmacien/stocks')
    return ok(PHARMA_STOCKS);

  // ── Analytics admin ───────────────────────────────────────────────
  if (method === 'GET' && path === '/analytics/dashboard')
    return ok(ANALYTICS);
  if (method === 'GET' && path.startsWith('/analytics'))
    return ok(ANALYTICS);

  // ── Délivrance ordonnance (POST mock) ────────────────────────────
  if (method === 'POST' && path.includes('/delivrer'))
    return ok({ montantGnf: 24000, statut: 'DELIVREE' });

  // ── Vitals save (POST mock) ───────────────────────────────────────
  if (method === 'POST' && path.includes('/vitals'))
    return ok({ ...VITALS_NORMAL, id: 'v-new' });

  // ── Diagnostic save (POST mock) ───────────────────────────────────
  if (method === 'POST' && path.includes('/diagnostics')) {
    const body = req.body as Record<string, unknown>;
    return ok({ id: `d-${Date.now()}`, ...body, statutClinique: 'ACTIF', source: 'ASC', creeLe: new Date().toISOString() });
  }

  // ── Ordonnance save (POST mock) ───────────────────────────────────
  if (method === 'POST' && path.includes('/ordonnances')) {
    const body = req.body as Record<string, unknown>;
    const med  = MEDICAMENTS.find(m => m.id === body?.['idMedicament']) ?? MEDICAMENTS[0];
    return ok({ id: `o-${Date.now()}`, ...body, statut: 'EN_ATTENTE', medicament: med });
  }

  // ── Clôture consultation ──────────────────────────────────────────
  if (method === 'POST' && path.includes('/complete'))
    return ok({ statut: 'TERMINEE' });

  // ── Référencement save ────────────────────────────────────────────
  if (method === 'POST' && path.includes('/referral')) {
    const body   = req.body as Record<string, unknown>;
    const target = STRUCTURES.find(s => s.id === body?.['idStructureCible']) ?? STRUCTURES[0];
    return ok({ id: `ref-${Date.now()}`, ...body, statut: 'EN_ATTENTE', structureCible: target });
  }

  // ── Toutes les autres requêtes → backend réel ─────────────────────
  return next(req);
};

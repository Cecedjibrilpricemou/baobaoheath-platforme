import { Component, signal, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelectModule } from 'primeng/multiselect';
import { SliderModule } from 'primeng/slider';
import { ProgressBarModule } from 'primeng/progressbar';
import { TagModule } from 'primeng/tag';
import { CardModule } from 'primeng/card';
import { AscService } from '../../../core/services/asc.service';
import { PatientService } from '../../../core/services/patient.service';
import { Patient } from '../../../core/models/patient.model';
import { TriageResult, TriageHypothese } from '../../../core/models/asc.model';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { I18nService } from '../../../shared/services/i18n.service';

@Component({
  selector: 'app-triage',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ButtonModule, InputTextModule,
    MultiSelectModule, SliderModule,
    ProgressBarModule, TagModule, CardModule, TranslatePipe
  ],
  templateUrl: './triage.html',
  styleUrl: './triage.scss',
})
export class Triage {
  private ascService = inject(AscService);
  private patientService = inject(PatientService);
  private router = inject(Router);
  private i18n = inject(I18nService);

  currentStep = signal(1);
  
  // Step 1: Patient
  patientRecherche = signal('');
  searchResults = signal<Patient[]>([]);
  patientTrouve = signal(false);
  patientData = signal<Patient | null>(null);
  isSearching = signal(false);
  searchError = signal('');

  // Step 2: Symptômes & Constantes
  get symptomesList() {
    return [
      { label: this.i18n.t('ASC.TRIAGE.SYMPTOM_FIEVRE'), value: 'fievre' },
      { label: this.i18n.t('ASC.TRIAGE.SYMPTOM_FRISSONS'), value: 'frissons' },
      { label: this.i18n.t('ASC.TRIAGE.SYMPTOM_TOUX'), value: 'toux' },
      { label: this.i18n.t('ASC.TRIAGE.SYMPTOM_CEPHALEE'), value: 'cephalee' },
      { label: this.i18n.t('ASC.TRIAGE.SYMPTOM_VOMISSEMENT'), value: 'vomissement' },
      { label: this.i18n.t('ASC.TRIAGE.SYMPTOM_DIARRHEE'), value: 'diarrhee' },
      { label: this.i18n.t('ASC.TRIAGE.SYMPTOM_FATIGUE'), value: 'fatigue' },
      { label: this.i18n.t('ASC.TRIAGE.SYMPTOM_DOULEUR_THORACIQUE'), value: 'douleur thoracique' },
      { label: this.i18n.t('ASC.TRIAGE.SYMPTOM_RESPIRATION_RAPIDE'), value: 'respiration rapide' },
      { label: this.i18n.t('ASC.TRIAGE.SYMPTOM_VERTIGE'), value: 'vertige' },
      { label: this.i18n.t('ASC.TRIAGE.SYMPTOM_VISION_TROUBLE'), value: 'vision trouble' },
      { label: this.i18n.t('ASC.TRIAGE.SYMPTOM_SOIF'), value: 'soif' },
      { label: this.i18n.t('ASC.TRIAGE.SYMPTOM_SAIGNEMENT'), value: 'saignement' },
      { label: this.i18n.t('ASC.TRIAGE.SYMPTOM_OEDEME'), value: 'oedeme' },
      { label: this.i18n.t('ASC.TRIAGE.SYMPTOM_ERUPTION'), value: 'eruption' },
      { label: this.i18n.t('ASC.TRIAGE.SYMPTOM_PLAIE'), value: 'plaie' }
    ];
  }
  selectedSymptomes = signal<string[]>([]);
  temperature = signal<number>(37);
  tension = signal<string>('12/8');

  // Step 3: IA Analysis
  isAnalysing = signal(false);
  iaProgress = signal(0);
  analysisResult = signal<{ score: number, gravity: string, recommendations: string[] } | null>(null);
  isCreating = signal(false);

  rechercherPatient() {
    const query = this.patientRecherche();
    if (!query || query.length < 2) return;

    this.isSearching.set(true);
    this.patientTrouve.set(false);
    this.searchResults.set([]);
    this.searchError.set('');

    this.patientService.getPatients(1, 5, undefined, query).subscribe({
      next: (response) => {
        this.isSearching.set(false);
        if (response.success && response.data) {
          const paginatedData = response.data;
          const items = (paginatedData as { items?: Patient[] })?.items ?? (Array.isArray(paginatedData) ? paginatedData : []);
          if (Array.isArray(items) && items.length > 0) {
            this.searchResults.set(items);
          } else {
            this.searchError.set(this.i18n.t('ASC.TRIAGE.ERR_NO_PATIENT_FOUND'));
          }
        }
      },
      error: () => {
        this.isSearching.set(false);
        this.searchError.set(this.i18n.t('ASC.TRIAGE.ERR_SEARCH'));
      }
    });
  }

  selectPatient(p: Patient) {
    this.patientData.set(p);
    this.patientTrouve.set(true);
  }

  nextStep() {
    if (this.currentStep() === 2) {
      this.currentStep.set(3);
      this.startIaAnalysis();
    } else {
      this.currentStep.update(v => v + 1);
    }
  }

  prevStep() {
    this.currentStep.update(v => v - 1);
  }

  startIaAnalysis() {
    this.isAnalysing.set(true);
    this.iaProgress.set(0);
    this.analysisResult.set(null);
    
    // Animer la barre de progression pendant l'appel API
    const interval = setInterval(() => {
      this.iaProgress.update(v => Math.min(v + 5, 90));
    }, 150);

    // Parser la tension pour extraire systolique
    const tensionParts = this.tension().split('/');
    const systolique = parseInt(tensionParts[0]) * 10 || undefined;

    // Appel au VRAI backend : POST /api/v1/triage/evaluer
    this.ascService.evaluateTriage({
      symptomes: this.selectedSymptomes(),
      constantes: {
        temperature: this.temperature(),
        tensionSystolique: systolique,
      }
    }).subscribe({
      next: (response) => {
        clearInterval(interval);
        this.iaProgress.set(100);

        setTimeout(() => {
          this.isAnalysing.set(false);
          if (response.success && response.data) {
            this.mapBackendResult(response.data);
          } else {
            this.generateFallbackResult();
          }
        }, 500);
      },
      error: () => {
        clearInterval(interval);
        this.iaProgress.set(100);
        setTimeout(() => {
          this.isAnalysing.set(false);
          this.generateFallbackResult();
        }, 500);
      }
    });
  }

  /**
   * Mappe la réponse du backend (moteur de règles) vers le format
   * attendu par le template existant (score/100, gravity, recommendations).
   */
  private mapBackendResult(data: TriageResult) {
    const urgence = data.urgence;
    let score: number;
    let gravity: string;

    if (urgence === 'URGENCE_VITALE') {
      score = 85;
      gravity = this.i18n.t('ASC.TRIAGE.GRAVITY_RED_VITAL');
    } else if (urgence === 'URGENT') {
      score = 55;
      gravity = this.i18n.t('ASC.TRIAGE.GRAVITY_ORANGE');
    } else {
      score = 15;
      gravity = this.i18n.t('ASC.TRIAGE.GRAVITY_GREEN');
    }

    const recommendations: string[] = [];

    // Ajouter les hypothèses du moteur de règles
    if (data.hypotheses && Array.isArray(data.hypotheses)) {
      data.hypotheses.forEach((h: TriageHypothese) => {
        recommendations.push(`${h.pathologie} — ${h.conduite}`);
      });
    }

    // Ajouter les alertes constantes vitales
    if (data.alertes && Array.isArray(data.alertes)) {
      data.alertes.forEach((a: string) => recommendations.push(this.i18n.t('ASC.TRIAGE.ALERT_PREFIX', { alert: a })));
    }

    // Ajouter la recommandation générale
    if (data.recommandation) {
      recommendations.push(data.recommandation);
    }

    this.analysisResult.set({ score, gravity, recommendations });
  }

  /**
   * Fallback si l'appel API échoue (mode dégradé).
   */
  private generateFallbackResult() {
    const symps = this.selectedSymptomes();
    const temp = this.temperature();
    
    if (symps.includes('vomissement') || temp > 39) {
      this.analysisResult.set({
        score: 85,
        gravity: this.i18n.t('ASC.TRIAGE.GRAVITY_RED'),
        recommendations: [
          this.i18n.t('ASC.TRIAGE.FALLBACK_REC_1_1'),
          this.i18n.t('ASC.TRIAGE.FALLBACK_REC_1_2'),
          this.i18n.t('ASC.TRIAGE.FALLBACK_REC_1_3')
        ]
      });
    } else if (symps.includes('fievre') || temp > 38) {
      this.analysisResult.set({
        score: 45,
        gravity: this.i18n.t('ASC.TRIAGE.GRAVITY_ORANGE_ALERT'),
        recommendations: [
          this.i18n.t('ASC.TRIAGE.FALLBACK_REC_2_1'),
          this.i18n.t('ASC.TRIAGE.FALLBACK_REC_2_2')
        ]
      });
    } else {
      this.analysisResult.set({
        score: 15,
        gravity: this.i18n.t('ASC.TRIAGE.GRAVITY_GREEN_LOW'),
        recommendations: [
          this.i18n.t('ASC.TRIAGE.FALLBACK_REC_3_1'),
          this.i18n.t('ASC.TRIAGE.FALLBACK_REC_3_2')
        ]
      });
    }
  }

  // Helpers pour le template (données dynamiques du patient)
  getPatientInitiales(p?: Patient): string {
    const patient = p || this.patientData();
    if (!patient) return '??';
    const prenom = patient.utilisateur?.prenom ?? patient.prenom ?? '';
    const nom = patient.utilisateur?.nom ?? patient.nom ?? '';
    return `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase();
  }

  getPatientNom(p?: Patient): string {
    const patient = p || this.patientData();
    if (!patient) return this.i18n.t('ASC.CONSULTATIONS.PATIENT_UNKNOWN');
    const prenom = patient.utilisateur?.prenom ?? patient.prenom ?? '';
    const nom = patient.utilisateur?.nom ?? patient.nom ?? '';
    return `${prenom} ${nom}`;
  }

  getPatientDetails(p?: Patient): string {
    const patient = p || this.patientData();
    if (!patient) return '';
    const sexe = patient.sexe === 'M' ? this.i18n.t('PATIENT.PROFILE.GENDER_M') : patient.sexe === 'F' ? this.i18n.t('PATIENT.PROFILE.GENDER_F') : patient.sexe ?? '';
    const prefecture = patient.prefecture ?? 'Conakry';
    return this.i18n.t('ASC.TRIAGE.PATIENT_DETAILS', { sexe, region: prefecture });
  }

  creerConsultation() {
    const patient = this.patientData();
    if (!patient) return;

    this.isCreating.set(true);

    const result = this.analysisResult();
    const payload = {
      idPatient: patient.id || 'fallback-id',
      motifPrincipal: this.i18n.t('ASC.TRIAGE.MOTIF_PREFIX') + ' ' + (result?.gravity || this.i18n.t('ASC.TRIAGE.GRAVITY_GREEN')),
      symptomes: this.selectedSymptomes()
    };

    this.ascService.saveConsultation(payload).subscribe({
      next: () => {
        this.isCreating.set(false);
        this.router.navigate(['/asc']);
      },
      error: () => {
        this.isCreating.set(false);
        // Fallback for demo if API fails
        this.router.navigate(['/asc']);
      }
    });
  }
}

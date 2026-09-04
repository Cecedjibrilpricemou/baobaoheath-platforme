// features/asc/consultation-detail/consultation-detail.component.ts
import { Component, inject, signal, OnInit } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { ConsultationService } from '../../../core/services/consultation.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { I18nService } from '../../../shared/services/i18n.service';

// ─── Interfaces alignées avec le backend ─────────────────

interface PatientInfo {
  id: string;
  qrCode?: string;
  dateNaissance?: string;
  sexe?: string;
  groupeSanguin?: string;
  allergies?: string[];
  utilisateur?: { prenom: string; nom: string; telephone: string; photoUrl?: string };
}

interface ConstantesVitales {
  id?: string;
  temperature?: number;
  poidsKg?: number;
  tailleCm?: number;
  perimetreBrachial?: number;
  tensionSystolique?: number;
  tensionDiastolique?: number;
  frequenceCardiaque?: number;
  frequenceRespiratoire?: number;
  spo2?: number;
  glycemie?: number;
  alertes?: string[];
}

interface Diagnostic {
  id: string;
  libelle: string;
  codeIcd11?: string;
  typeDiagnostic: string;
  severite?: string;
  statutClinique: string;
  source: string;
  creeLe: string;
}

interface Ordonnance {
  id: string;
  posologie: string;
  frequence: string;
  dureeJours: number;
  instructions?: string;
  statut: string;
  medicament: { dci: string; nomCommercial?: string; forme: string; dosage: string };
}

interface Referencement {
  id: string;
  urgence: string;
  statut: string;
  resumeClinique: string;
  structureCible: { nom: string; type: string; prefecture: string };
}

interface Consultation {
  id: string;
  statut: string;
  motifPrincipal: string;
  symptomes: string[];
  notesAsc?: string;
  protocoleUtilise?: string;
  confianceIa?: number;
  resumeIa?: string;
  consulteeLE: string;
  patient: PatientInfo;
  constantes?: ConstantesVitales;
  diagnostics: Diagnostic[];
  ordonnances: Ordonnance[];
  referencement?: Referencement;
}

interface Medicament {
  id: string;
  dci: string;
  nomCommercial?: string;
  forme: string;
  dosage: string;
}

interface Structure {
  id: string;
  nom: string;
  type: string;
  prefecture: string;
}

@Component({
  selector: 'app-consultation-detail',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatIconModule, MatButtonModule,
    TranslatePipe
  ],
  templateUrl: './consultation-detail.component.html',
  styleUrl: './consultation-detail.component.scss'
})
export class ConsultationDetailComponent implements OnInit {
  private api    = inject(ApiService);
  private consultationService = inject(ConsultationService);
  private route  = inject(ActivatedRoute);
  private router = inject(Router);
  private i18n   = inject(I18nService);

  consultation    = signal<Consultation | null>(null);
  isLoading       = signal(true);
  errorMessage    = signal('');
  successMessage  = signal('');
  activeSection   = signal<'vitals' | 'diagnostics' | 'ordonnances' | 'referral'>('vitals');

  // ── Constantes vitales ──────────────────────────────────
  vitalsForm: ConstantesVitales = {};
  isSavingVitals  = signal(false);
  vitalsAlerts    = signal<{ level: 'danger' | 'warn'; message: string }[]>([]);

  onVitalsChange() {
    const v = this.vitalsForm;
    const alerts: { level: 'danger' | 'warn'; message: string }[] = [];

    if (v.spo2 != null) {
      if (v.spo2 < 90)       alerts.push({ level: 'danger', message: this.i18n.t('ASC.CONSULTATION_DETAIL.ALERT_SPO2_CRITICAL', { v: v.spo2 }) });
      else if (v.spo2 < 95)  alerts.push({ level: 'warn',   message: this.i18n.t('ASC.CONSULTATION_DETAIL.ALERT_SPO2_LOW', { v: v.spo2 }) });
    }
    if (v.temperature != null) {
      if (v.temperature >= 39)         alerts.push({ level: 'danger', message: this.i18n.t('ASC.CONSULTATION_DETAIL.ALERT_HYPERTHERMIA_SEVERE', { v: v.temperature }) });
      else if (v.temperature >= 38)    alerts.push({ level: 'warn',   message: this.i18n.t('ASC.CONSULTATION_DETAIL.ALERT_FEVER', { v: v.temperature }) });
      else if (v.temperature < 36)     alerts.push({ level: 'warn',   message: this.i18n.t('ASC.CONSULTATION_DETAIL.ALERT_HYPOTHERMIA', { v: v.temperature }) });
    }
    if (v.tensionSystolique != null) {
      if (v.tensionSystolique >= 180)  alerts.push({ level: 'danger', message: this.i18n.t('ASC.CONSULTATION_DETAIL.ALERT_HTA_SEVERE', { v: v.tensionSystolique }) });
      else if (v.tensionSystolique >= 140) alerts.push({ level: 'warn', message: this.i18n.t('ASC.CONSULTATION_DETAIL.ALERT_HTA', { v: v.tensionSystolique }) });
      else if (v.tensionSystolique < 90)   alerts.push({ level: 'danger', message: this.i18n.t('ASC.CONSULTATION_DETAIL.ALERT_HYPOTENSION', { v: v.tensionSystolique }) });
    }
    if (v.frequenceCardiaque != null) {
      if (v.frequenceCardiaque > 120)  alerts.push({ level: 'danger', message: this.i18n.t('ASC.CONSULTATION_DETAIL.ALERT_TACHY_SEVERE', { v: v.frequenceCardiaque }) });
      else if (v.frequenceCardiaque > 100) alerts.push({ level: 'warn', message: this.i18n.t('ASC.CONSULTATION_DETAIL.ALERT_TACHY', { v: v.frequenceCardiaque }) });
      else if (v.frequenceCardiaque < 60)  alerts.push({ level: 'warn', message: this.i18n.t('ASC.CONSULTATION_DETAIL.ALERT_BRADY', { v: v.frequenceCardiaque }) });
    }
    if (v.frequenceRespiratoire != null) {
      if (v.frequenceRespiratoire > 25)  alerts.push({ level: 'danger', message: this.i18n.t('ASC.CONSULTATION_DETAIL.ALERT_TACHYPNEA_SEVERE', { v: v.frequenceRespiratoire }) });
      else if (v.frequenceRespiratoire < 12) alerts.push({ level: 'warn', message: this.i18n.t('ASC.CONSULTATION_DETAIL.ALERT_BRADYPNEA', { v: v.frequenceRespiratoire }) });
    }
    if (v.glycemie != null) {
      if (v.glycemie < 0.70)   alerts.push({ level: 'danger', message: this.i18n.t('ASC.CONSULTATION_DETAIL.ALERT_HYPOGLYCEMIA', { v: v.glycemie }) });
      else if (v.glycemie > 3.0) alerts.push({ level: 'danger', message: this.i18n.t('ASC.CONSULTATION_DETAIL.ALERT_HYPERGLYCEMIA_CRITICAL', { v: v.glycemie }) });
      else if (v.glycemie > 2.0) alerts.push({ level: 'warn',   message: this.i18n.t('ASC.CONSULTATION_DETAIL.ALERT_HYPERGLYCEMIA_HIGH', { v: v.glycemie }) });
    }

    this.vitalsAlerts.set(alerts);
  }

  // ── Diagnostic ──────────────────────────────────────────
  diagnosticForm: {
    libelle: string; codeIcd11: string;
    typeDiagnostic: 'PRINCIPAL' | 'DIFFERENTIEL' | 'SECONDAIRE';
    severite: string; source: 'ASC';
  } = {
    libelle: '', codeIcd11: '', typeDiagnostic: 'PRINCIPAL', severite: '', source: 'ASC'
  };
  isSavingDiagnostic = signal(false);
  get typesDiagnostic() {
    return [
      { label: this.i18n.t('ASC.CONSULTATION_DETAIL.TYPE_PRINCIPAL'), value: 'PRINCIPAL' },
      { label: this.i18n.t('ASC.CONSULTATION_DETAIL.TYPE_SECONDAIRE'), value: 'SECONDAIRE' },
      { label: this.i18n.t('ASC.CONSULTATION_DETAIL.TYPE_DIFFERENTIEL'), value: 'DIFFERENTIEL' }
    ];
  }
  get severites() {
    return [
      { label: this.i18n.t('ASC.CONSULTATION_DETAIL.SEVERITE_LEGERE'), value: 'LEGERE' },
      { label: this.i18n.t('ASC.CONSULTATION_DETAIL.SEVERITE_MODEREE'), value: 'MODEREE' },
      { label: this.i18n.t('ASC.CONSULTATION_DETAIL.SEVERITE_SEVERE'), value: 'SEVERE' },
      { label: this.i18n.t('ASC.CONSULTATION_DETAIL.SEVERITE_CRITIQUE'), value: 'CRITIQUE' }
    ];
  }

  // ── Ordonnance ──────────────────────────────────────────
  ordonnanceForm = {
    idMedicament: '',
    posologie: '',
    frequence: '',
    dureeJours: 7,
    instructions: ''
  };
  medicaments     = signal<Medicament[]>([]);
  isSavingOrdonnance = signal(false);

  // ── Référencement ────────────────────────────────────────
  referralForm: {
    idStructureCible: string;
    urgence: 'ROUTINE' | 'URGENT' | 'URGENCE_VITALE';
    resumeClinique: string;
  } = { idStructureCible: '', urgence: 'ROUTINE', resumeClinique: '' };
  structures      = signal<Structure[]>([]);
  isSavingReferral = signal(false);
  get urgences() {
    return [
      { label: this.i18n.t('ASC.CONSULTATION_DETAIL.URGENCE_ROUTINE'), value: 'ROUTINE' },
      { label: this.i18n.t('ASC.CONSULTATION_DETAIL.URGENCE_URGENT'), value: 'URGENT' },
      { label: this.i18n.t('ASC.CONSULTATION_DETAIL.URGENCE_VITALE'), value: 'URGENCE_VITALE' }
    ];
  }

  // ── Clôture ──────────────────────────────────────────────
  isClosing           = signal(false);
  showCloseConfirm    = signal(false);

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadConsultation(id);
      this.loadMedicaments();
      this.loadStructures();
    }
  }

  private loadConsultation(id: string) {
    this.isLoading.set(true);
    this.consultationService.getConsultationById(id).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const data = response.data as unknown as Consultation;
          this.consultation.set(data);
          // Pré-remplir le formulaire vitaux si déjà saisis
          if (data.constantes) {
            this.vitalsForm = { ...data.constantes };
            this.onVitalsChange();
          }
        }
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set(this.i18n.t('ASC.CONSULTATION_DETAIL.ERR_LOAD'));
        this.isLoading.set(false);
      }
    });
  }

  private loadMedicaments() {
    this.api.get<{ data?: unknown[]; success?: boolean } | unknown[]>('/medicaments').subscribe({
      next: (r) => this.medicaments.set((Array.isArray(r) ? r : (r as { data?: unknown[] })?.data ?? []) as Medicament[]),
      error: () => {}
    });
  }

  private loadStructures() {
    this.api.get<{ data?: unknown[]; success?: boolean } | unknown[]>('/structures').subscribe({
      next: (r) => this.structures.set((Array.isArray(r) ? r : (r as { data?: unknown[] })?.data ?? []) as Structure[]),
      error: () => {}
    });
  }

  // ── Sauvegarder constantes vitales ──────────────────────
  saveVitals() {
    const id = this.consultation()?.id;
    if (!id) return;
    this.isSavingVitals.set(true);
    this.consultationService.saveVitals(id, this.vitalsForm).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const constantes = response.data;
          const c = this.consultation();
          if (c) this.consultation.set({ ...c, constantes });
          this.isSavingVitals.set(false);
          this.showSuccess(this.i18n.t('ASC.CONSULTATION_DETAIL.SUCCESS_VITALS'));
        }
      },
      error: (err) => {
        this.isSavingVitals.set(false);
        this.showError(err?.error?.message ?? this.i18n.t('ASC.CONSULTATION_DETAIL.ERR_SAVE_GENERIC'));
      }
    });
  }

  // ── Ajouter diagnostic ───────────────────────────────────
  saveDiagnostic() {
    const id = this.consultation()?.id;
    if (!id || !this.diagnosticForm.libelle) return;
    this.isSavingDiagnostic.set(true);
    this.consultationService.saveDiagnostic(id, {
      ...this.diagnosticForm,
      severite: (this.diagnosticForm.severite as 'LEGER' | 'MODERE' | 'SEVERE' | 'CRITIQUE') || undefined
    }).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const data = response.data;
          const c = this.consultation();
          if (c) this.consultation.set({ ...c, diagnostics: [...c.diagnostics, data as unknown as Diagnostic] });
          this.diagnosticForm = { libelle: '', codeIcd11: '', typeDiagnostic: 'PRINCIPAL', severite: '', source: 'ASC' };
          this.isSavingDiagnostic.set(false);
          this.showSuccess(this.i18n.t('ASC.CONSULTATION_DETAIL.SUCCESS_DIAGNOSTIC'));
        }
      },
      error: (err) => {
        this.isSavingDiagnostic.set(false);
        this.showError(err?.error?.message ?? this.i18n.t('ASC.CONSULTATION_DETAIL.ERR_ADD_GENERIC'));
      }
    });
  }

  // ── Ajouter ordonnance ───────────────────────────────────
  saveOrdonnance() {
    const id = this.consultation()?.id;
    if (!id || !this.ordonnanceForm.idMedicament) return;
    this.isSavingOrdonnance.set(true);
    this.consultationService.saveOrdonnance(id, this.ordonnanceForm).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const data = response.data;
          const c = this.consultation();
          if (c) this.consultation.set({ ...c, ordonnances: [...c.ordonnances, data as unknown as Ordonnance] });
          this.ordonnanceForm = { idMedicament: '', posologie: '', frequence: '', dureeJours: 7, instructions: '' };
          this.isSavingOrdonnance.set(false);
          this.showSuccess(this.i18n.t('ASC.CONSULTATION_DETAIL.SUCCESS_ORDONNANCE'));
        }
      },
      error: (err) => {
        this.isSavingOrdonnance.set(false);
        this.showError(err?.error?.message ?? this.i18n.t('ASC.CONSULTATION_DETAIL.ERR_ADD_GENERIC'));
      }
    });
  }

  // ── Créer référencement ──────────────────────────────────
  saveReferral() {
    const id = this.consultation()?.id;
    if (!id || !this.referralForm.idStructureCible || !this.referralForm.resumeClinique) return;
    this.isSavingReferral.set(true);
    this.consultationService.saveReferral(id, this.referralForm).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const ref = response.data;
          const c = this.consultation();
          if (c) this.consultation.set({ ...c, referencement: ref as unknown as Referencement, statut: 'REFERENCEE' });
          this.isSavingReferral.set(false);
          this.showSuccess(this.i18n.t('ASC.CONSULTATION_DETAIL.SUCCESS_REFERRAL'));
        }
      },
      error: (err) => {
        this.isSavingReferral.set(false);
        this.showError(err?.error?.message ?? this.i18n.t('ASC.CONSULTATION_DETAIL.ERR_REFERRAL'));
      }
    });
  }

  // ── Clôturer la consultation ─────────────────────────────
  closeConsultation() {
    const id = this.consultation()?.id;
    if (!id) return;
    this.isClosing.set(true);
    this.showCloseConfirm.set(false);
    this.consultationService.closeConsultation(id).subscribe({
      next: () => {
        const c = this.consultation();
        if (c) this.consultation.set({ ...c, statut: 'TERMINEE' });
        this.isClosing.set(false);
        this.showSuccess(this.i18n.t('ASC.CONSULTATION_DETAIL.SUCCESS_CLOSE'));
      },
      error: (err) => {
        this.isClosing.set(false);
        this.showError(err?.error?.message ?? this.i18n.t('ASC.CONSULTATION_DETAIL.ERR_CLOSE'));
      }
    });
  }

  // ── Helpers ──────────────────────────────────────────────
  isConsultationTerminee(): boolean {
    return this.consultation()?.statut === 'TERMINEE' || this.consultation()?.statut === 'REFERENCEE';
  }

  /** Variante de badge correspondant au statut d'une consultation. */
  getStatutVariante(statut: string): string {
    const map: Record<string, string> = {
      'TERMINEE': 'success', 'EN_COURS': 'warning',
      'PLANIFIEE': 'info', 'ANNULEE': 'danger', 'REFERENCEE': 'neutral'
    };
    return map[statut] ?? 'neutral';
  }

  /** Variante de badge correspondant au degre d'urgence d'un referencement. */
  getUrgenceVariante(urgence: string): string {
    const map: Record<string, string> = {
      'ROUTINE': 'info', 'URGENT': 'warning', 'URGENCE_VITALE': 'danger'
    };
    return map[urgence] ?? 'info';
  }

  getStatutSeverity(statut: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    const map: Record<string, any> = {
      'TERMINEE': 'success', 'EN_COURS': 'warn',
      'PLANIFIEE': 'info', 'ANNULEE': 'danger', 'REFERENCEE': 'secondary'
    };
    return map[statut] ?? 'secondary';
  }

  getStatutLabel(statut: string): string {
    const known = ['TERMINEE', 'EN_COURS', 'PLANIFIEE', 'ANNULEE', 'REFERENCEE'];
    return known.includes(statut) ? this.i18n.t(`STATUT.${statut}`) : statut;
  }

  getUrgenceSeverity(urgence: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    const map: Record<string, any> = {
      'ROUTINE': 'info', 'URGENT': 'warn', 'URGENCE_VITALE': 'danger'
    };
    return map[urgence] ?? 'info';
  }

  getMedicamentLabel(m: Medicament): string {
    return m.nomCommercial ? `${m.nomCommercial} (${m.dci}) — ${m.dosage}` : `${m.dci} ${m.dosage}`;
  }

  getPatientNom(): string {
    const p = this.consultation()?.patient;
    return p?.utilisateur ? `${p.utilisateur.prenom} ${p.utilisateur.nom}` : '—';
  }

  getInitiales(): string {
    const p = this.consultation()?.patient?.utilisateur;
    if (!p) return '?';
    return `${p.prenom?.charAt(0) ?? ''}${p.nom?.charAt(0) ?? ''}`.toUpperCase();
  }

  formatDate(d: string): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  private showSuccess(msg: string) {
    this.successMessage.set(msg);
    this.errorMessage.set('');
    setTimeout(() => this.successMessage.set(''), 3000);
  }

  private showError(msg: string) {
    this.errorMessage.set(msg);
    this.successMessage.set('');
    setTimeout(() => this.errorMessage.set(''), 4000);
  }

  goBack() { this.router.navigate(['/asc/consultations']); }
}

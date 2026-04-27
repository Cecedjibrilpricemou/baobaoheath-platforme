// features/asc/consultation-detail/consultation-detail.component.ts
import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { InputNumberModule } from 'primeng/inputnumber';
import { SkeletonModule } from 'primeng/skeleton';
import { DividerModule } from 'primeng/divider';
import { SelectModule } from 'primeng/select';
import { ApiService } from '../../../core/services/api.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

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
    CommonModule, FormsModule, RouterLink,
    ButtonModule, TagModule, CardModule,
    InputTextModule, TextareaModule, InputNumberModule,
    SkeletonModule, DividerModule, SelectModule,
    TranslatePipe
  ],
  templateUrl: './consultation-detail.component.html',
  styleUrl: './consultation-detail.component.scss'
})
export class ConsultationDetailComponent implements OnInit {
  private api    = inject(ApiService);
  private route  = inject(ActivatedRoute);
  private router = inject(Router);

  consultation    = signal<Consultation | null>(null);
  isLoading       = signal(true);
  errorMessage    = signal('');
  successMessage  = signal('');
  activeSection   = signal<'vitals' | 'diagnostics' | 'ordonnances' | 'referral'>('vitals');

  // ── Constantes vitales ──────────────────────────────────
  vitalsForm: ConstantesVitales = {};
  isSavingVitals = signal(false);

  // ── Diagnostic ──────────────────────────────────────────
  diagnosticForm = {
    libelle: '',
    codeIcd11: '',
    typeDiagnostic: 'PRINCIPAL',
    severite: '',
    source: 'ASC'
  };
  isSavingDiagnostic = signal(false);
  typesDiagnostic = [
    { label: 'Principal', value: 'PRINCIPAL' },
    { label: 'Secondaire', value: 'SECONDAIRE' },
    { label: 'Différentiel', value: 'DIFFERENTIEL' }
  ];
  severites = [
    { label: 'Légère', value: 'LEGERE' },
    { label: 'Modérée', value: 'MODEREE' },
    { label: 'Sévère', value: 'SEVERE' },
    { label: 'Critique', value: 'CRITIQUE' }
  ];

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
  referralForm = {
    idStructureCible: '',
    urgence: 'ROUTINE',
    resumeClinique: ''
  };
  structures      = signal<Structure[]>([]);
  isSavingReferral = signal(false);
  urgences = [
    { label: 'Routine', value: 'ROUTINE' },
    { label: 'Urgent', value: 'URGENT' },
    { label: 'Urgence Vitale', value: 'URGENCE_VITALE' }
  ];

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
    this.api.get<any>(`/consultations/${id}`).subscribe({
      next: (response) => {
        const data = response?.data ?? response;
        this.consultation.set(data);
        // Pré-remplir le formulaire vitaux si déjà saisis
        if (data.constantes) {
          this.vitalsForm = { ...data.constantes };
        }
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Impossible de charger la consultation.');
        this.isLoading.set(false);
      }
    });
  }

  private loadMedicaments() {
    this.api.get<any>('/medicaments').subscribe({
      next: (r) => this.medicaments.set(Array.isArray(r) ? r : r?.data ?? []),
      error: () => {}
    });
  }

  private loadStructures() {
    this.api.get<any>('/structures').subscribe({
      next: (r) => this.structures.set(Array.isArray(r) ? r : r?.data ?? []),
      error: () => {}
    });
  }

  // ── Sauvegarder constantes vitales ──────────────────────
  saveVitals() {
    const id = this.consultation()?.id;
    if (!id) return;
    this.isSavingVitals.set(true);
    this.api.post<any>(`/consultations/${id}/vitals`, this.vitalsForm).subscribe({
      next: (response) => {
        const data = response?.data ?? response;
        const c = this.consultation();
        if (c) this.consultation.set({ ...c, constantes: data });
        this.isSavingVitals.set(false);
        this.showSuccess('Constantes vitales sauvegardées !');
      },
      error: (err) => {
        this.isSavingVitals.set(false);
        this.showError(err?.error?.message ?? 'Erreur lors de la sauvegarde.');
      }
    });
  }

  // ── Ajouter diagnostic ───────────────────────────────────
  saveDiagnostic() {
    const id = this.consultation()?.id;
    if (!id || !this.diagnosticForm.libelle) return;
    this.isSavingDiagnostic.set(true);
    this.api.post<any>(`/consultations/${id}/diagnostics`, this.diagnosticForm).subscribe({
      next: (response) => {
        const data = response?.data ?? response;
        const c = this.consultation();
        if (c) this.consultation.set({ ...c, diagnostics: [...c.diagnostics, data] });
        this.diagnosticForm = { libelle: '', codeIcd11: '', typeDiagnostic: 'PRINCIPAL', severite: '', source: 'ASC' };
        this.isSavingDiagnostic.set(false);
        this.showSuccess('Diagnostic ajouté !');
      },
      error: (err) => {
        this.isSavingDiagnostic.set(false);
        this.showError(err?.error?.message ?? 'Erreur lors de l\'ajout.');
      }
    });
  }

  // ── Ajouter ordonnance ───────────────────────────────────
  saveOrdonnance() {
    const id = this.consultation()?.id;
    if (!id || !this.ordonnanceForm.idMedicament) return;
    this.isSavingOrdonnance.set(true);
    this.api.post<any>(`/consultations/${id}/ordonnances`, this.ordonnanceForm).subscribe({
      next: (response) => {
        const data = response?.data ?? response;
        const c = this.consultation();
        if (c) this.consultation.set({ ...c, ordonnances: [...c.ordonnances, data] });
        this.ordonnanceForm = { idMedicament: '', posologie: '', frequence: '', dureeJours: 7, instructions: '' };
        this.isSavingOrdonnance.set(false);
        this.showSuccess('Ordonnance ajoutée !');
      },
      error: (err) => {
        this.isSavingOrdonnance.set(false);
        this.showError(err?.error?.message ?? 'Erreur lors de l\'ajout.');
      }
    });
  }

  // ── Créer référencement ──────────────────────────────────
  saveReferral() {
    const id = this.consultation()?.id;
    if (!id || !this.referralForm.idStructureCible || !this.referralForm.resumeClinique) return;
    this.isSavingReferral.set(true);
    this.api.post<any>(`/consultations/${id}/referral`, this.referralForm).subscribe({
      next: (response) => {
        const data = response?.data ?? response;
        const c = this.consultation();
        if (c) this.consultation.set({ ...c, referencement: data, statut: 'REFERENCEE' });
        this.isSavingReferral.set(false);
        this.showSuccess('Référencement créé !');
      },
      error: (err) => {
        this.isSavingReferral.set(false);
        this.showError(err?.error?.message ?? 'Erreur lors du référencement.');
      }
    });
  }

  // ── Clôturer la consultation ─────────────────────────────
  closeConsultation() {
    const id = this.consultation()?.id;
    if (!id) return;
    this.isClosing.set(true);
    this.showCloseConfirm.set(false);
    this.api.post<any>(`/consultations/${id}/complete`, {}).subscribe({
      next: () => {
        const c = this.consultation();
        if (c) this.consultation.set({ ...c, statut: 'TERMINEE' });
        this.isClosing.set(false);
        this.showSuccess('Consultation clôturée avec succès !');
      },
      error: (err) => {
        this.isClosing.set(false);
        this.showError(err?.error?.message ?? 'Erreur lors de la clôture.');
      }
    });
  }

  // ── Helpers ──────────────────────────────────────────────
  isConsultationTerminee(): boolean {
    return this.consultation()?.statut === 'TERMINEE' || this.consultation()?.statut === 'REFERENCEE';
  }

  getStatutSeverity(statut: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    const map: Record<string, any> = {
      'TERMINEE': 'success', 'EN_COURS': 'warn',
      'PLANIFIEE': 'info', 'ANNULEE': 'danger', 'REFERENCEE': 'secondary'
    };
    return map[statut] ?? 'secondary';
  }

  getStatutLabel(statut: string): string {
    const map: Record<string, string> = {
      'TERMINEE': 'Terminée', 'EN_COURS': 'En cours',
      'PLANIFIEE': 'Planifiée', 'ANNULEE': 'Annulée', 'REFERENCEE': 'Référencée'
    };
    return map[statut] ?? statut;
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

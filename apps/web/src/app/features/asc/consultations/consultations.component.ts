// features/asc/consultations/consultations.component.ts
import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { TableModule } from 'primeng/table';
import { SkeletonModule } from 'primeng/skeleton';
import { AscService } from '../../../core/services/asc.service';
import { AuthService } from '../../../core/services/auth.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { I18nService } from '../../../shared/services/i18n.service';
import { Consultation } from '../../../core/models/asc.model';
import { Patient } from '../../../core/models/patient.model';

@Component({
  selector: 'app-consultations',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    ButtonModule, InputTextModule, SelectModule,
    TagModule, TableModule, SkeletonModule,
    TranslatePipe
  ],
  templateUrl: './consultations.component.html',
  styleUrl: './consultations.component.scss'
})
export class ConsultationsComponent implements OnInit {
  private ascService = inject(AscService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private i18n = inject(I18nService);

  currentUser = this.authService.currentUser;
  consultations = signal<Consultation[]>([]);
  patients = signal<Patient[]>([]);
  isLoading = signal(true);
  showNewForm = signal(false);
  isSaving = signal(false);
  successMessage = signal('');
  errorMessage = signal('');
  totalConsultations = signal(0);
  enCours = signal(0);
  terminees = signal(0);
  filtreStatut = signal('TOUS');

  statuts = ['TOUS', 'PLANIFIEE', 'EN_COURS', 'TERMINEE', 'ANNULEE'];

  statutOptions = this.statuts.map(s => ({
    label: s === 'TOUS' ? 'Tous' : this.getStatutLabel(s),
    value: s
  }));

  newConsultation = { patientId: '', motif: '' };

  ngOnInit() { this.loadConsultations(); this.loadPatients(); }

  private loadConsultations() {
    this.isLoading.set(true);
    this.ascService.getHistoriqueConsultations(1, 100).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const data = response.data.items || [];
          this.consultations.set(data);
          this.totalConsultations.set(data.length);
          this.enCours.set(data.filter((c: Consultation) => c.statut === 'EN_COURS').length);
          this.terminees.set(data.filter((c: Consultation) => c.statut === 'TERMINEE').length);
        }
        this.isLoading.set(false);
      },
      error: () => { this.isLoading.set(false); }
    });
  }

  private loadPatients() {
    this.ascService.searchPatients('').subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.patients.set(response.data);
        }
      },
      error: () => { }
    });
  }

  get consultationsFiltrees(): Consultation[] {
    const f = this.filtreStatut();
    return f === 'TOUS' ? this.consultations() : this.consultations().filter(c => c.statut === f);
  }

  // ── Navigation vers le détail ─────────────────────────────
  voirDetail(consultation: Consultation) {
    this.router.navigate(['/asc/consultations', consultation.id]);
  }

  getMotif(c: Consultation & { motifPrincipal?: string }): string {
    return c.motifPrincipal ?? c.motif ?? '—';
  }

  openNewForm() { this.showNewForm.set(true); this.newConsultation = { patientId: '', motif: '' }; this.errorMessage.set(''); }
  closeNewForm() { this.showNewForm.set(false); this.errorMessage.set(''); }

  createConsultation() {
    if (!this.newConsultation.patientId) { this.errorMessage.set(this.i18n.t('ASC.CONSULTATIONS.ERR_PATIENT')); return; }
    this.isSaving.set(true); this.errorMessage.set('');
    
    this.ascService.saveConsultation({
      idPatient: this.newConsultation.patientId,
      motifPrincipal: this.newConsultation.motif,
      symptomes: [] // Require symptoms to be captured in the detail view or logic later
    }).subscribe({
      next: (response) => {
        this.isSaving.set(false); this.showNewForm.set(false);
        this.successMessage.set(this.i18n.t('ASC.CONSULTATIONS.SUCCESS_CREATE'));
        setTimeout(() => this.successMessage.set(''), 3000);
        // Naviguer directement vers le détail de la nouvelle consultation
        const id = response?.data?.id;
        if (id) {
          this.router.navigate(['/asc/consultations', id]);
        } else {
          this.loadConsultations();
        }
      },
      error: (err) => { this.isSaving.set(false); this.errorMessage.set(err?.error?.message ?? this.i18n.t('ASC.CONSULTATIONS.ERR_CREATE')); }
    });
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  getStatutSeverity(statut: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    const map: Record<string, 'success' | 'info' | 'warn' | 'danger' | 'secondary'> = {
      'EN_COURS': 'warn', 'TERMINEE': 'success', 'PLANIFIEE': 'info', 'ANNULEE': 'danger', 'REFERENCEE': 'secondary'
    };
    return map[statut] ?? 'secondary';
  }

  getStatutLabel(statut: string): string {
    const map: Record<string, string> = {
      'EN_COURS': 'En cours', 'TERMINEE': 'Terminée', 'PLANIFIEE': 'Planifiée', 'ANNULEE': 'Annulée', 'REFERENCEE': 'Référencée'
    };
    return map[statut] ?? statut;
  }

  getPatientInitiales(c: Consultation): string {
    const u = c.patient;
    if (!u) return '??';
    return `${u.utilisateur?.prenom?.charAt(0) ?? u.prenom?.charAt(0) ?? ''}${u.utilisateur?.nom?.charAt(0) ?? u.nom?.charAt(0) ?? ''}`.toUpperCase();
  }
}

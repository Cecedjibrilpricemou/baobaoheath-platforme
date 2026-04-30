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
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

interface Consultation {
  id: string; consulteeLE: string; statut: string; motif?: string;
  motifPrincipal?: string;
  patient?: { utilisateur: { nom: string; prenom: string; telephone: string; }; };
}
interface Patient {
  id: string;
  utilisateur: { nom: string; prenom: string; telephone: string; };
}

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
  private api = inject(ApiService);
  private authService = inject(AuthService);
  private router = inject(Router);

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
    this.api.get<any>('/consultations').subscribe({
      next: (response) => {
        const data = Array.isArray(response) ? response : response?.data ?? [];
        this.consultations.set(data);
        this.totalConsultations.set(data.length);
        this.enCours.set(data.filter((c: Consultation) => c.statut === 'EN_COURS').length);
        this.terminees.set(data.filter((c: Consultation) => c.statut === 'TERMINEE').length);
        this.isLoading.set(false);
      },
      error: () => { this.isLoading.set(false); }
    });
  }

  private loadPatients() {
    // TODO: quand la zone de couverture ASC sera définie,
    // revenir sur /asc/patients pour n'afficher que les patients de la zone
    this.api.get<any>('/patients').subscribe({
      next: (response) => {
        const data = Array.isArray(response) ? response : response?.data ?? [];
        this.patients.set(data);
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

  getMotif(c: Consultation): string {
    return c.motifPrincipal ?? c.motif ?? '—';
  }

  openNewForm() { this.showNewForm.set(true); this.newConsultation = { patientId: '', motif: '' }; this.errorMessage.set(''); }
  closeNewForm() { this.showNewForm.set(false); this.errorMessage.set(''); }

  createConsultation() {
    if (!this.newConsultation.patientId) { this.errorMessage.set('Veuillez sélectionner un patient.'); return; }
    this.isSaving.set(true); this.errorMessage.set('');
    this.api.post<any>('/consultations', {
      idPatient: this.newConsultation.patientId,
      motifPrincipal: this.newConsultation.motif
    }).subscribe({
      next: (response) => {
        this.isSaving.set(false); this.showNewForm.set(false);
        this.successMessage.set('Consultation ouverte avec succès !');
        setTimeout(() => this.successMessage.set(''), 3000);
        // Naviguer directement vers le détail de la nouvelle consultation
        const id = response?.data?.id ?? response?.id;
        if (id) {
          this.router.navigate(['/asc/consultations', id]);
        } else {
          this.loadConsultations();
        }
      },
      error: (err) => { this.isSaving.set(false); this.errorMessage.set(err?.error?.message ?? 'Erreur lors de la création.'); }
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
    const u = c.patient?.utilisateur;
    if (!u) return '??';
    return `${u.prenom?.charAt(0) ?? ''}${u.nom?.charAt(0) ?? ''}`.toUpperCase();
  }
}

// features/patient/profil/profil.component.ts
import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { DividerModule } from 'primeng/divider';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { PatientService } from '../../../core/services/patient.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { Patient } from '../../../core/models/patient.model';

interface Structure {
  id: string; nom: string; type: string; prefecture: string;
}

@Component({
  selector: 'app-profil',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink,
    ButtonModule, InputTextModule, SelectModule,
    TextareaModule, CardModule, TagModule, SkeletonModule, DividerModule,
    TranslatePipe
  ],
  templateUrl: './profil.component.html',
  styleUrl: './profil.component.scss'
})
export class ProfilComponent implements OnInit {
  private api = inject(ApiService);
  private authService = inject(AuthService);
  private patientService = inject(PatientService);

  currentUser = this.authService.currentUser;
  profil = signal<Patient | null>(null);
  structures = signal<Structure[]>([]);
  isLoading = signal(true);
  isSaving = signal(false);
  isSavingStructure = signal(false);
  isExporting = signal(false);
  editMode = signal(false);
  successMessage = signal('');
  errorMessage = signal('');
  formData: Partial<Patient> = {};
  idStructureSelectionnee = '';

  sexeOptions = [{ label: 'Masculin', value: 'M' }, { label: 'Féminin', value: 'F' }];
  bloodOptions = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(v => ({ label: v, value: v }));

  get structureOptions() {
    return [
      { label: '— Aucune structure (accès libre) —', value: '' },
      ...this.structures().map(s => ({
        label: `${s.nom} — ${s.prefecture}`,
        value: s.id
      }))
    ];
  }

  ngOnInit() { this.loadProfil(); this.loadStructures(); }

  private loadProfil() {
    this.isLoading.set(true);
    this.patientService.getMe().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const data = response.data;
          this.profil.set(data);
          this.formData = { ...data };
          this.idStructureSelectionnee = data.idStructurePreferee ?? '';
        }
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Impossible de charger votre profil.');
        this.isLoading.set(false);
      }
    });
  }

  private loadStructures() {
    // Keep this one using api.service since we haven't created AdminStructureService yet
    this.api.get<{ data?: Structure[]; success?: boolean } | Structure[]>('/admin-structure/structures/publiques').subscribe({
      next: (response) => {
        const data = Array.isArray(response) ? response : (response as { data?: Structure[] })?.data ?? [];
        this.structures.set(data.filter((s: Structure) => s.type !== 'PHARMACIE'));
      },
      error: () => { }
    });
  }

  enableEdit() { this.formData = { ...this.profil() }; this.editMode.set(true); }
  cancelEdit() { this.editMode.set(false); this.errorMessage.set(''); }

  private toArray(value: unknown): string[] | undefined {
    if (Array.isArray(value)) return value.filter((v) => typeof v === 'string' && v.trim().length > 0);
    if (typeof value === 'string') return value.split(',').map((v) => v.trim()).filter(Boolean);
    return undefined;
  }

  private buildUpdatePayload() {
    const f = this.formData;
    // The backend only accepts a specific set of fields on this endpoint (see
    // updatePatientSchema — telephone/dateNaissance/sexe are read-only here).
    // Sending the raw fetched object back (including nulls and unknown keys)
    // makes the strict Zod schema reject the whole request.
    return {
      ...(f.prenom && { prenom: f.prenom }),
      ...(f.nom && { nom: f.nom }),
      ...(f.groupeSanguin && { groupeSanguin: f.groupeSanguin }),
      ...(this.toArray(f.allergies)?.length && { allergies: this.toArray(f.allergies) }),
      ...(this.toArray(f.maladiesChroniques)?.length && { maladiesChroniques: this.toArray(f.maladiesChroniques) }),
    };
  }

  saveProfil() {
    this.isSaving.set(true);
    this.patientService.updateMe(this.buildUpdatePayload()).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.editMode.set(false);
        this.showSuccess('Profil mis à jour avec succès !');
        this.loadProfil();
      },
      error: (err) => {
        this.isSaving.set(false);
        this.errorMessage.set(err?.error?.message ?? 'Erreur lors de la mise à jour.');
      }
    });
  }

  saveStructurePreferee() {
    this.isSavingStructure.set(true);
    this.patientService.setStructurePreferee(this.idStructureSelectionnee || null).subscribe({
      next: () => {
        this.isSavingStructure.set(false);
        this.showSuccess(
          this.idStructureSelectionnee
            ? 'Structure préférée mise à jour !'
            : 'Vous n\'êtes plus rattaché à une structure.'
        );
        this.loadProfil();
      },
      error: (err) => {
        this.isSavingStructure.set(false);
        this.errorMessage.set(err?.error?.message ?? 'Erreur lors de la mise à jour.');
      }
    });
  }

  exportDossier() {
    this.isExporting.set(true);
    this.patientService.exportDossier().subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(new Blob(['{}']));
        const a = document.createElement('a');
        a.href = url;
        a.download = `dossier-${this.profil()?.utilisateur?.nom ?? this.profil()?.nom ?? 'patient'}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.isExporting.set(false);
      },
      error: () => { this.isExporting.set(false); }
    });
  }

  getInitiales(): string {
    const p = this.profil();
    const u = this.currentUser();
    const prenom = p?.utilisateur?.prenom ?? p?.prenom ?? u?.prenom ?? '';
    const nom = p?.utilisateur?.nom ?? p?.nom ?? u?.nom ?? '';
    return `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase() || '??';
  }

  formatDate(dateStr?: string): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'long', year: 'numeric'
    });
  }

  getAllergies(): string {
    const a = this.profil()?.allergies;
    if (!a) return '—';
    return Array.isArray(a) ? a.join(', ') : a;
  }

  getTypeLabel(type: string): string {
    const map: Record<string, string> = {
      'POSTE': 'Poste de Santé', 'CENTRE': 'Centre de Santé',
      'HOPITAL_PREF': 'Hôpital Préfectoral', 'HOPITAL_REG': 'Hôpital Régional',
      'CHU': 'CHU', 'CLINIQUE': 'Clinique Privée'
    };
    return map[type] ?? type;
  }

  private showSuccess(msg: string) {
    this.successMessage.set(msg);
    setTimeout(() => this.successMessage.set(''), 3000);
  }
}
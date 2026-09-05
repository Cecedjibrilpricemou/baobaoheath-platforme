// features/patient/profil/profil.component.ts
import { Component, inject, signal, OnInit } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { PatientService } from '../../../core/services/patient.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { I18nService } from '../../../shared/services/i18n.service';
import { Patient } from '../../../core/models/patient.model';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';

interface Structure {
  id: string; nom: string; type: string; prefecture: string;
}

const TAILLE_MAX_PHOTO = 3 * 1024 * 1024;
const TYPES_PHOTO_ACCEPTES = ['image/jpeg', 'image/png', 'image/webp'];

@Component({
  selector: 'app-profil',
  standalone: true,
  imports: [
    MatFormFieldModule, MatInputModule, MatSelectModule,
    CommonModule, FormsModule, RouterLink,
    TranslatePipe, AvatarComponent
  ],
  templateUrl: './profil.component.html',
  styleUrl: './profil.component.scss'
})
export class ProfilComponent implements OnInit {
  private api = inject(ApiService);
  private authService = inject(AuthService);
  private patientService = inject(PatientService);
  private i18n = inject(I18nService);

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
  isUploadingPhoto = signal(false);

  bloodOptions = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(v => ({ label: v, value: v }));

  get structureOptions() {
    return [
      { label: this.i18n.t('PATIENT.PROFILE.STRUCTURE_SELECT_PLACEHOLDER'), value: '' },
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
        this.errorMessage.set(this.i18n.t('PATIENT.PROFILE.ERR_LOAD'));
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
        this.showSuccess(this.i18n.t('PATIENT.PROFILE.SUCCESS_SAVE'));
        this.loadProfil();
      },
      error: (err) => {
        this.isSaving.set(false);
        this.errorMessage.set(err?.error?.message ?? this.i18n.t('PATIENT.PROFILE.ERR_UPDATE'));
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
            ? this.i18n.t('PATIENT.PROFILE.STRUCTURE_UPDATED')
            : this.i18n.t('PATIENT.PROFILE.STRUCTURE_UNLINKED')
        );
        this.loadProfil();
      },
      error: (err) => {
        this.isSavingStructure.set(false);
        this.errorMessage.set(err?.error?.message ?? this.i18n.t('PATIENT.PROFILE.ERR_UPDATE'));
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

  onPhotoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    if (!TYPES_PHOTO_ACCEPTES.includes(file.type)) {
      this.errorMessage.set(this.i18n.t('PROFIL_MODAL.ERR_PHOTO_TYPE')); return;
    }
    if (file.size > TAILLE_MAX_PHOTO) {
      this.errorMessage.set(this.i18n.t('PROFIL_MODAL.ERR_PHOTO_SIZE')); return;
    }

    this.isUploadingPhoto.set(true); this.errorMessage.set('');
    this.authService.uploadAvatar(file).subscribe({
      next: ({ url }) => {
        this.authService.updateProfil({ photoUrl: url }).subscribe({
          next: () => {
            this.isUploadingPhoto.set(false);
            this.successMessage.set(this.i18n.t('PROFIL_MODAL.SUCCESS_PHOTO_UPDATED'));
            setTimeout(() => this.successMessage.set(''), 3000);
          },
          error: () => {
            this.isUploadingPhoto.set(false);
            this.errorMessage.set(this.i18n.t('PROFIL_MODAL.ERR_UPDATE'));
          }
        });
      },
      error: () => {
        this.isUploadingPhoto.set(false);
        this.errorMessage.set(this.i18n.t('PROFIL_MODAL.ERR_PHOTO_UPLOAD'));
      }
    });
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
    const known = ['POSTE', 'CENTRE', 'HOPITAL_PREF', 'HOPITAL_REG', 'CHU', 'CLINIQUE'];
    return known.includes(type) ? this.i18n.t(`PATIENT.PROFILE.STRUCTURE_TYPE_${type}`) : type;
  }

  private showSuccess(msg: string) {
    this.successMessage.set(msg);
    setTimeout(() => this.successMessage.set(''), 3000);
  }
}
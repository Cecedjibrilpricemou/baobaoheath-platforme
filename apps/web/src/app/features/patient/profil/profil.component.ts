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
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

interface PatientProfil {
  id: string; telephone: string; nom: string; prenom: string;
  dateNaissance?: string; sexe?: string; adresse?: string;
  groupeSanguin?: string; allergies?: string | string[];
  antecedents?: string; qrCode?: string;
  idStructurePreferee?: string;
  structurePreferee?: { id: string; nom: string; type: string; prefecture: string };
  utilisateur?: { id: string; telephone: string; nom: string; prenom: string; email?: string };
}

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

  currentUser = this.authService.currentUser;
  profil = signal<PatientProfil | null>(null);
  structures = signal<Structure[]>([]);
  isLoading = signal(true);
  isSaving = signal(false);
  isSavingStructure = signal(false);
  isExporting = signal(false);
  editMode = signal(false);
  successMessage = signal('');
  errorMessage = signal('');
  formData: Partial<PatientProfil> = {};
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
    this.api.get<any>('/patients/me').subscribe({
      next: (response) => {
        const data = response?.data ?? response;
        const profil: PatientProfil = {
          id: data?.id ?? '',
          telephone: data?.utilisateur?.telephone ?? data?.telephone ?? '',
          nom: data?.utilisateur?.nom ?? data?.nom ?? '',
          prenom: data?.utilisateur?.prenom ?? data?.prenom ?? '',
          dateNaissance: data?.dateNaissance,
          sexe: data?.sexe,
          adresse: data?.adresse ?? data?.village,
          groupeSanguin: data?.groupeSanguin,
          allergies: data?.allergies,
          antecedents: data?.antecedents,
          qrCode: data?.qrCode,
          idStructurePreferee: data?.idStructurePreferee,
          structurePreferee: data?.structurePreferee,
          utilisateur: data?.utilisateur
        };
        this.profil.set(profil);
        this.formData = { ...profil };
        this.idStructureSelectionnee = data?.idStructurePreferee ?? '';
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Impossible de charger votre profil.');
        this.isLoading.set(false);
      }
    });
  }

  private loadStructures() {
    this.api.get<any>('/admin-structure/structures/publiques').subscribe({
      next: (response) => {
        const data = Array.isArray(response) ? response : response?.data ?? [];
        this.structures.set(data.filter((s: Structure) => s.type !== 'PHARMACIE'));
      },
      error: () => { }
    });
  }

  enableEdit() { this.formData = { ...this.profil() }; this.editMode.set(true); }
  cancelEdit() { this.editMode.set(false); this.errorMessage.set(''); }

  // Aligné avec le template HTML qui appelle saveProfil()
  saveProfil() {
    this.isSaving.set(true);
    this.api.put<any>('/patients/me', this.formData).subscribe({
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
    this.api.put<any>('/patients/me/structure', {
      idStructure: this.idStructureSelectionnee || null
    }).subscribe({
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
    this.api.get<any>('/patients/me/export').subscribe({
      next: (data) => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dossier-${this.profil()?.nom ?? 'patient'}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.isExporting.set(false);
      },
      error: () => { this.isExporting.set(false); }
    });
  }

  // Méthode manquante — utilisée dans le template
  getInitiales(): string {
    const p = this.profil();
    const u = this.currentUser();
    const prenom = p?.prenom ?? u?.prenom ?? '';
    const nom = p?.nom ?? u?.nom ?? '';
    return `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase() || '??';
  }

  // Méthode manquante — utilisée dans le template
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
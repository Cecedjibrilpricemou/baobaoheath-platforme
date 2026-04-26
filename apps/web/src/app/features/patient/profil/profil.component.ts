// features/patient/profil/profil.component.ts

import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';

interface PatientProfil {
  id: string;
  telephone: string;
  nom: string;
  prenom: string;
  dateNaissance?: string;
  sexe?: string;
  adresse?: string;
  groupeSanguin?: string;
  allergies?: string | string[];
  antecedents?: string;
  qrCode?: string;
  utilisateur?: {
    id: string;
    telephone: string;
    nom: string;
    prenom: string;
    email?: string;
  };
}

@Component({
  selector: 'app-profil',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './profil.component.html',
  styleUrl: './profil.component.scss'
})
export class ProfilComponent implements OnInit {
  private api = inject(ApiService);
  private authService = inject(AuthService);

  currentUser = this.authService.currentUser;
  profil = signal<PatientProfil | null>(null);

  isLoading = signal(true);
  isSaving = signal(false);
  isExporting = signal(false);
  editMode = signal(false);
  successMessage = signal('');
  errorMessage = signal('');

  formData: Partial<PatientProfil> = {};

  ngOnInit() {
    this.loadProfil();
  }

  private loadProfil() {
    this.isLoading.set(true);
    this.api.get<any>('/patients/me').subscribe({
      next: (response) => {
        // Gère les deux formats : { data: {...} } ou directement l'objet
        const data = response?.data ?? response;
        // Fusionne utilisateur + patientProfile
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
          utilisateur: data?.utilisateur
        };
        this.profil.set(profil);
        this.formData = { ...profil };
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Impossible de charger votre profil.');
        this.isLoading.set(false);
      }
    });
  }

  enableEdit() {
    this.formData = { ...this.profil() };
    this.editMode.set(true);
  }

  cancelEdit() {
    this.editMode.set(false);
    this.errorMessage.set('');
  }

  saveProfil() {
    this.isSaving.set(true);
    this.errorMessage.set('');

    this.api.put<any>('/patients/me', this.formData).subscribe({
      next: (response) => {
        const data = response?.data ?? response;
        this.profil.set({ ...this.profil()!, ...data });
        this.isSaving.set(false);
        this.editMode.set(false);
        this.successMessage.set('Profil mis à jour avec succès !');
        setTimeout(() => this.successMessage.set(''), 3000);
      },
      error: (err) => {
        this.isSaving.set(false);
        this.errorMessage.set(err?.error?.message ?? 'Erreur lors de la sauvegarde.');
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

  formatDate(dateStr?: string): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'long', year: 'numeric'
    });
  }

  getInitiales(): string {
    const p = this.profil();
    const prenom = p?.prenom ?? this.currentUser()?.prenom ?? '';
    const nom = p?.nom ?? this.currentUser()?.nom ?? '';
    return `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase() || '??';
  }

  getAllergies(): string {
    const a = this.profil()?.allergies;
    if (!a) return '—';
    if (Array.isArray(a)) return a.length === 0 ? 'Aucune allergie connue' : a.join(', ');
    return a;
  }
}
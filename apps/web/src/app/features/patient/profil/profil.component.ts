// features/patient/profil/profil.component.ts
// Rôle : page profil du patient — affichage et modification des infos
// Permet aussi l'export du dossier médical complet

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
    allergies?: string;
    antecedents?: string;
    qrCode?: string;
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

    // Données
    currentUser = this.authService.currentUser;
    profil = signal<PatientProfil | null>(null);

    // États UI
    isLoading = signal(true);
    isSaving = signal(false);
    isExporting = signal(false);
    editMode = signal(false);
    successMessage = signal('');
    errorMessage = signal('');

    // Formulaire d'édition
    formData: Partial<PatientProfil> = {};

    ngOnInit() {
        this.loadProfil();
    }

    private loadProfil() {
        this.isLoading.set(true);
        this.api.get<PatientProfil>('/patients/me').subscribe({
            next: (data) => {
                this.profil.set(data);
                this.formData = { ...data };
                this.isLoading.set(false);
            },
            error: () => {
                this.errorMessage.set('Impossible de charger votre profil.');
                this.isLoading.set(false);
            }
        });
    }

    // Activer le mode édition
    enableEdit() {
        this.formData = { ...this.profil() };
        this.editMode.set(true);
    }

    // Annuler l'édition
    cancelEdit() {
        this.editMode.set(false);
        this.errorMessage.set('');
    }

    // Sauvegarder les modifications
    saveProfil() {
        this.isSaving.set(true);
        this.errorMessage.set('');

        this.api.put<PatientProfil>('/patients/me', this.formData).subscribe({
            next: (data) => {
                this.profil.set(data);
                this.isSaving.set(false);
                this.editMode.set(false);
                this.successMessage.set('Profil mis à jour avec succès !');
                setTimeout(() => this.successMessage.set(''), 3000);
            },
            error: (err) => {
                this.isSaving.set(false);
                this.errorMessage.set(
                    err?.error?.message ?? 'Erreur lors de la sauvegarde.'
                );
            }
        });
    }

    // Exporter le dossier médical
    exportDossier() {
        this.isExporting.set(true);
        this.api.get<any>('/patients/me/export').subscribe({
            next: (data) => {
                // Télécharger le fichier JSON
                const blob = new Blob([JSON.stringify(data, null, 2)], {
                    type: 'application/json'
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `dossier-medical-${this.profil()?.nom}-${this.profil()?.prenom}.json`;
                a.click();
                URL.revokeObjectURL(url);
                this.isExporting.set(false);
            },
            error: () => {
                this.isExporting.set(false);
                this.errorMessage.set('Erreur lors de l\'export du dossier.');
            }
        });
    }

    // Formate une date ISO
    formatDate(dateStr?: string): string {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });
    }

    // Initiales pour l'avatar
    getInitiales(): string {
        const p = this.profil();
        if (!p) return '??';
        return `${p.prenom?.charAt(0) ?? ''}${p.nom?.charAt(0) ?? ''}`.toUpperCase();
    }
}
// features/patient/dashboard/dashboard.component.ts
// Rôle : tableau de bord principal du patient
// Affiche : infos patient, consultations récentes, vaccinations, rendez-vous

import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';

// Interface consultation
interface Consultation {
    id: string;
    date: string;
    statut: string;
    motif?: string;
    asc?: { nom: string; prenom: string };
}

// Interface vaccination
interface Vaccination {
    id: string;
    vaccin: string;
    dateAdministration: string;
    prochainRappel?: string;
}

// Interface rendez-vous
interface RendezVous {
    id: string;
    date: string;
    motif?: string;
    statut: string;
}

@Component({
    selector: 'app-dashboard',
    standalone: true,
    imports: [CommonModule, RouterLink],
    templateUrl: './dashboard.component.html',
    styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
    private api = inject(ApiService);
    private authService = inject(AuthService);

    // Données utilisateur connecté
    currentUser = this.authService.currentUser;

    // Signals pour les données
    consultations = signal<Consultation[]>([]);
    vaccinations = signal<Vaccination[]>([]);
    isLoading = signal(true);
    errorMessage = signal('');

    // Stats rapides calculées
    totalConsultations = signal(0);
    totalVaccinations = signal(0);
    prochainRdv = signal<RendezVous | null>(null);

    ngOnInit() {
        this.loadDashboard();
    }

    private loadDashboard() {
        this.isLoading.set(true);

        // Charger les consultations du patient
        this.api.get<any>('/consultations').subscribe({
            next: (data) => {
                const consultations = Array.isArray(data) ? data : data?.data ?? [];
                this.consultations.set(consultations.slice(0, 5));
                this.totalConsultations.set(consultations.length);
                this.isLoading.set(false);
            },
            error: () => {
                // En cas d'erreur API on affiche des données vides
                this.isLoading.set(false);
            }
        });

        // Charger les vaccinations du patient
        this.api.get<any>('/vaccinations/me').subscribe({
            next: (data) => {
                const vaccinations = Array.isArray(data) ? data : data?.data ?? [];
                this.vaccinations.set(vaccinations.slice(0, 3));
                this.totalVaccinations.set(vaccinations.length);
            },
            error: () => { }
        });
    }

    // Retourne la classe CSS selon le statut
    getStatutClass(statut: string): string {
        const map: Record<string, string> = {
            'TERMINEE': 'badge--success',
            'EN_COURS': 'badge--warning',
            'PLANIFIEE': 'badge--info',
            'ANNULEE': 'badge--danger',
            'REFERENCEE': 'badge--purple'
        };
        return map[statut] ?? 'badge--default';
    }

    // Retourne le label lisible du statut
    getStatutLabel(statut: string): string {
        const map: Record<string, string> = {
            'TERMINEE': 'Terminée',
            'EN_COURS': 'En cours',
            'PLANIFIEE': 'Planifiée',
            'ANNULEE': 'Annulée',
            'REFERENCEE': 'Référencée'
        };
        return map[statut] ?? statut;
    }

    // Formate une date ISO en date lisible
    formatDate(dateStr: string): string {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    }
}
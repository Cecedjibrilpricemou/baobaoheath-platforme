// features/auth/login/login.component.ts
// Rôle : composant de connexion BaoBaoHealth
// Gère le formulaire login avec numéro de téléphone + mot de passe
// Redirige vers le bon dashboard selon le rôle après connexion

import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { LoginPayload } from '../../../core/models/user.model';

@Component({
    selector: 'app-login',
    standalone: true,
    // FormsModule → ngModel pour la liaison bidirectionnelle du formulaire
    // RouterLink → lien vers la page register
    // CommonModule → directives *ngIf, *ngFor etc.
    imports: [FormsModule, RouterLink, CommonModule],
    templateUrl: './login.component.html',
    styleUrl: './login.component.scss'
})
export class LoginComponent {
    private authService = inject(AuthService);
    private router = inject(Router);

    // Données du formulaire liées via ngModel
    formData: LoginPayload = {
        telephone: '',
        motDePasse: ''
    };

    // Signals pour gérer les états UI
    isLoading = signal(false);       // true pendant l'appel API
    errorMessage = signal('');       // message d'erreur affiché à l'utilisateur
    showPassword = signal(false);    // toggle affichage mot de passe

    // Toggle visibilité du mot de passe
    togglePassword() {
        this.showPassword.update(v => !v);
    }

    // Soumission du formulaire
    onSubmit() {
        // Validation basique avant envoi
        if (!this.formData.telephone || !this.formData.motDePasse) {
            this.errorMessage.set('Veuillez remplir tous les champs.');
            return;
        }

        // Réinitialise l'erreur et active le loader
        this.errorMessage.set('');
        this.isLoading.set(true);

        this.authService.login(this.formData).subscribe({
            next: (response) => {
                this.isLoading.set(false);
                // Redirige vers le bon dashboard selon le rôle de l'utilisateur
                this.redirectByRole(response.user.role);
            },
            error: (err) => {
                this.isLoading.set(false);
                // Affiche le message d'erreur retourné par l'API ou un message générique
                this.errorMessage.set(
                    err?.error?.message ?? 'Identifiants incorrects. Veuillez réessayer.'
                );
            }
        });
    }

    // Redirige vers le dashboard correspondant au rôle connecté
    private redirectByRole(role: string) {
        const redirectMap: Record<string, string> = {
            PATIENT: '/patient/dashboard',
            ASC: '/asc/consultations',
            ASC_SUPERVISOR: '/asc/consultations',
            MEDECIN: '/medecin/dashboard',
            PHARMACIEN: '/medecin/dashboard',
            ADMIN_STRUCTURE: '/admin/analytics',
            ADMIN_REGIONAL: '/admin/analytics',
            ADMIN_NATIONAL: '/admin/analytics',
            SUPER_ADMIN: '/admin/analytics'
        };

        const destination = redirectMap[role] ?? '/auth/login';
        this.router.navigate([destination]);
    }
}
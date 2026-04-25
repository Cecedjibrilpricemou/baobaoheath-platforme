// features/auth/register/register.component.ts
// Rôle : composant d'inscription BaoBaoHealth
// Permet de créer un compte avec choix du rôle
// Redirige vers login après inscription réussie

import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { RegisterPayload, Role } from '../../../core/models/user.model';

@Component({
    selector: 'app-register',
    standalone: true,
    imports: [FormsModule, RouterLink, CommonModule],
    templateUrl: './register.component.html',
    styleUrl: './register.component.scss'
})
export class RegisterComponent {
    private authService = inject(AuthService);
    private router = inject(Router);

    // Données du formulaire liées via ngModel
    formData: RegisterPayload = {
        nom: '',
        prenom: '',
        telephone: '',
        motDePasse: '',
        role: 'PATIENT'
    };

    // Confirmation mot de passe — champ local non envoyé à l'API
    confirmMotDePasse = '';

    // Signals pour gérer les états UI
    isLoading = signal(false);
    errorMessage = signal('');
    successMessage = signal('');
    showPassword = signal(false);
    showConfirmPassword = signal(false);

    // Liste des rôles disponibles à l'inscription publique
    // Les rôles admin sont créés par le super admin — pas ici
    rolesDisponibles: { value: Role; label: string; icon: string }[] = [
        { value: 'PATIENT', label: 'Patient', icon: 'pi-user' },
        { value: 'ASC', label: 'Agent de Santé', icon: 'pi-heart' },
        { value: 'MEDECIN', label: 'Médecin', icon: 'pi-plus-circle' },
        { value: 'PHARMACIEN', label: 'Pharmacien', icon: 'pi-box' },
    ];

    // Toggle affichage mot de passe
    togglePassword() { this.showPassword.update(v => !v); }
    toggleConfirmPassword() { this.showConfirmPassword.update(v => !v); }

    // Sélection du rôle via les cards cliquables
    selectRole(role: Role) {
        this.formData.role = role;
    }

    // Validation du formulaire avant envoi
    private validate(): boolean {
        if (!this.formData.nom || !this.formData.prenom) {
            this.errorMessage.set('Veuillez entrer votre nom et prénom.');
            return false;
        }
        if (!this.formData.telephone) {
            this.errorMessage.set('Veuillez entrer votre numéro de téléphone.');
            return false;
        }
        if (this.formData.motDePasse.length < 6) {
            this.errorMessage.set('Le mot de passe doit contenir au moins 6 caractères.');
            return false;
        }
        if (this.formData.motDePasse !== this.confirmMotDePasse) {
            this.errorMessage.set('Les mots de passe ne correspondent pas.');
            return false;
        }
        return true;
    }

    // Soumission du formulaire
    onSubmit() {
        this.errorMessage.set('');
        this.successMessage.set('');

        // Validation locale avant appel API
        if (!this.validate()) return;

        this.isLoading.set(true);

        this.authService.register(this.formData).subscribe({
            next: () => {
                this.isLoading.set(false);
                this.successMessage.set('Compte créé avec succès ! Redirection...');
                // Redirection vers login après 1.5 secondes
                setTimeout(() => this.router.navigate(['/auth/login']), 1500);
            },
            error: (err) => {
                this.isLoading.set(false);
                this.errorMessage.set(
                    err?.error?.message ?? 'Erreur lors de la création du compte.'
                );
            }
        });
    }
}
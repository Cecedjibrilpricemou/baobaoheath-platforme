// features/auth/register/register.component.ts
import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { AuthService } from '../../../core/services/auth.service';
import { RegisterPayload, Role } from '../../../core/models/user.model';
import { ThemeService } from '../../../shared/services/theme.service';
import { I18nService } from '../../../shared/services/i18n.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    FormsModule, RouterLink, CommonModule,
    ButtonModule, InputTextModule,
    InputGroupModule, InputGroupAddonModule,
    TranslatePipe
  ],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss'
})
export class RegisterComponent {
  private authService   = inject(AuthService);
  private router        = inject(Router);
  readonly themeService = inject(ThemeService);
  private i18nService   = inject(I18nService);

  formData: RegisterPayload = {
    nom: '', prenom: '', telephone: '', email: '', motDePasse: '', role: 'PATIENT'
  };
  confirmMotDePasse = '';

  isLoading           = signal(false);
  errorMessage        = signal('');
  successMessage      = signal('');
  showPassword        = signal(false);
  showConfirmPassword = signal(false);

  // Seuls les rôles créables par le patient lui-même
  rolesDisponibles: { value: Role; label: string; icon: string }[] = [
    { value: 'PATIENT',    label: 'Patient',        icon: 'pi-user'        },
    { value: 'ASC',        label: 'Agent de Santé', icon: 'pi-heart'       },
    { value: 'MEDECIN',    label: 'Médecin',        icon: 'pi-plus-circle' },
    { value: 'PHARMACIEN', label: 'Pharmacien',     icon: 'pi-box'         }
  ];

  togglePassword()        { this.showPassword.update(v => !v); }
  toggleConfirmPassword() { this.showConfirmPassword.update(v => !v); }
  selectRole(role: Role)  { this.formData.role = role; }
  toggleTheme()           { this.themeService.toggle(); }
  toggleLang()            { this.i18nService.toggle(); }

  private validate(): boolean {
    if (!this.formData.nom || !this.formData.prenom) {
      this.errorMessage.set('Veuillez saisir votre nom et prénom.'); return false;
    }
    if (!this.formData.telephone) {
      this.errorMessage.set('Le numéro de téléphone est obligatoire.'); return false;
    }
    // Validation email si fourni
    if (this.formData.email && !this.formData.email.includes('@')) {
      this.errorMessage.set('L\'adresse email n\'est pas valide.'); return false;
    }
    if (this.formData.motDePasse.length < 6) {
      this.errorMessage.set('Le mot de passe doit contenir au moins 6 caractères.'); return false;
    }
    if (this.formData.motDePasse !== this.confirmMotDePasse) {
      this.errorMessage.set('Les mots de passe ne correspondent pas.'); return false;
    }
    return true;
  }

  onSubmit() {
    this.errorMessage.set('');
    this.successMessage.set('');
    if (!this.validate()) return;

    this.isLoading.set(true);

    // Nettoyer email vide avant envoi
    const payload: RegisterPayload = {
      ...this.formData,
      email: this.formData.email?.trim() || undefined
    };

    this.authService.register(payload).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.successMessage.set('Compte créé avec succès ! Redirection...');
        setTimeout(() => this.router.navigate(['/auth/login']), 1500);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(
          err?.error?.message ?? err?.error?.error ?? 'Une erreur est survenue.'
        );
      }
    });
  }
}

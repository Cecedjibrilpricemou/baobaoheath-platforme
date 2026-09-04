// features/auth/register/register.component.ts
// Register public — PATIENT uniquement
// Les autres rôles (ASC, Médecin, Pharmacien) sont créés par l'ADMIN_STRUCTURE

import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { RegisterPayload } from '../../../core/models/user.model';
import { ThemeService } from '../../../shared/services/theme.service';
import { I18nService } from '../../../shared/services/i18n.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    MatButtonModule,
    MatFormFieldModule, MatInputModule,
    FormsModule, RouterLink, CommonModule,
    TranslatePipe
  ],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss'
})
export class RegisterComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  readonly themeService = inject(ThemeService);
  private i18nService = inject(I18nService);
  private toastr = inject(ToastrService);

  // Rôle fixé à PATIENT — les autres rôles sont créés par l'admin de structure
  formData: RegisterPayload & { email?: string } = {
    nom: '', prenom: '', telephone: '', email: '', motDePasse: '', role: 'PATIENT'
  };
  confirmMotDePasse = '';

  isLoading = signal(false);
  showPassword = signal(false);
  showConfirmPassword = signal(false);

  togglePassword() { this.showPassword.update(v => !v); }
  toggleConfirmPassword() { this.showConfirmPassword.update(v => !v); }
  toggleTheme() { this.themeService.toggle(); }
  toggleLang() { this.i18nService.toggle(); }

  private validate(): boolean {
    const errTitle = this.i18nService.t('AUTH.REGISTER.ERR_TITLE');
    if (!this.formData.nom || !this.formData.prenom) {
      this.toastr.error(this.i18nService.t('AUTH.REGISTER.ERR_NAME'), errTitle); return false;
    }
    if (!this.formData.telephone) {
      this.toastr.error(this.i18nService.t('AUTH.REGISTER.ERR_PHONE'), errTitle); return false;
    }
    if (this.formData.email && !this.formData.email.includes('@')) {
      this.toastr.error(this.i18nService.t('AUTH.REGISTER.ERR_EMAIL'), errTitle); return false;
    }
    if (this.formData.motDePasse.length < 6) {
      this.toastr.error(this.i18nService.t('AUTH.REGISTER.ERR_PWD_SHORT'), errTitle); return false;
    }
    if (this.formData.motDePasse !== this.confirmMotDePasse) {
      this.toastr.error(this.i18nService.t('AUTH.REGISTER.ERR_PWD_MATCH'), errTitle); return false;
    }
    return true;
  }

  onSubmit() {
    if (!this.validate()) return;

    this.isLoading.set(true);

    const payload: RegisterPayload = {
      nom: this.formData.nom,
      prenom: this.formData.prenom,
      telephone: this.formData.telephone,
      motDePasse: this.formData.motDePasse,
      ...(this.formData.email?.trim() ? { email: this.formData.email.trim() } : {})
    };

    this.authService.register(payload).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.toastr.success(this.i18nService.t('AUTH.REGISTER.SUCCESS'), this.i18nService.t('AUTH.REGISTER.SUCCESS_TITLE'));
        setTimeout(() => this.router.navigate(['/auth/login']), 1500);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.toastr.error(
          err?.error?.message ?? err?.error?.error ?? this.i18nService.t('AUTH.REGISTER.ERR_GENERIC'),
          this.i18nService.t('AUTH.REGISTER.ERR_REGISTER_TITLE')
        );
      }
    });
  }
}

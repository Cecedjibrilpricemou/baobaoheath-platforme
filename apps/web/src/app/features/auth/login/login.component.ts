// features/auth/login/login.component.ts
import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { AuthService } from '../../../core/services/auth.service';
import { LoginPayload } from '../../../core/models/user.model';
import { ThemeService } from '../../../shared/services/theme.service';
import { I18nService } from '../../../shared/services/i18n.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    FormsModule, RouterLink, CommonModule,
    ButtonModule, InputTextModule,
    InputGroupModule, InputGroupAddonModule,
    TranslatePipe
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  private authService   = inject(AuthService);
  private router        = inject(Router);
  readonly themeService = inject(ThemeService);
  private i18nService   = inject(I18nService);

  // identifiant = téléphone ou email — détection automatique côté backend
  formData: LoginPayload = { identifiant: '', motDePasse: '' };

  isLoading    = signal(false);
  errorMessage = signal('');
  showPassword = signal(false);

  // Placeholder dynamique selon ce que l'utilisateur saisit
  get identifiantPlaceholder(): string {
    return this.i18nService.t('AUTH.LOGIN.PLACEHOLDER_IDENTIFIANT');
  }

  get identifiantIcon(): string {
    return this.formData.identifiant.includes('@') ? 'pi pi-envelope' : 'pi pi-phone';
  }

  togglePassword() { this.showPassword.update(v => !v); }
  toggleTheme()    { this.themeService.toggle(); }
  toggleLang()     { this.i18nService.toggle(); }

  onSubmit() {
    if (!this.formData.identifiant || !this.formData.motDePasse) {
      this.errorMessage.set(this.i18nService.t('AUTH.LOGIN.ERR_FIELDS'));
      return;
    }
    this.errorMessage.set('');
    this.isLoading.set(true);

    this.authService.login(this.formData).subscribe({
      next: (user) => {
        this.isLoading.set(false);
        this.redirectByRole(user.role);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(
          err?.error?.error ?? err?.error?.message ?? this.i18nService.t('AUTH.LOGIN.ERR_CREDENTIALS')
        );
      }
    });
  }

  private redirectByRole(role: string) {
    const redirectMap: Record<string, string> = {
      PATIENT:          '/patient/dashboard',
      ASC:              '/asc/consultations',
      ASC_SUPERVISOR:   '/asc/consultations',
      MEDECIN:          '/medecin/dashboard',
      PHARMACIEN:       '/pharmacien/scanner',
      ADMIN_STRUCTURE:  '/admin-structure/dashboard',
      ADMIN_REGIONAL:   '/admin/analytics',
      ADMIN_NATIONAL:   '/admin/analytics',
      SUPER_ADMIN:      '/admin/analytics'
    };
    this.router.navigate([redirectMap[role] ?? '/auth/login']);
  }
}

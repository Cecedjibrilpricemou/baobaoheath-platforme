// features/auth/forgot-password/forgot-password.component.ts
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { AuthService } from '../../../core/services/auth.service';
import { ThemeService } from '../../../shared/services/theme.service';
import { I18nService } from '../../../shared/services/i18n.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [
    FormsModule, RouterLink,
    ButtonModule, InputTextModule,
    InputGroupModule, InputGroupAddonModule,
    TranslatePipe
  ],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.scss'
})
export class ForgotPasswordComponent {
  private authService   = inject(AuthService);
  readonly themeService = inject(ThemeService);
  private i18nService   = inject(I18nService);
  private toastr        = inject(ToastrService);

  email     = '';
  isLoading = signal(false);
  submitted = signal(false);

  toggleTheme() { this.themeService.toggle(); }
  toggleLang()  { this.i18nService.toggle(); }

  onSubmit() {
    if (!this.email || !this.email.includes('@')) {
      this.toastr.error(this.i18nService.t('AUTH.FORGOT.ERR_EMAIL'), 'Erreur');
      return;
    }
    this.isLoading.set(true);

    this.authService.forgotPassword(this.email.trim().toLowerCase()).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.submitted.set(true);
      },
      error: () => {
        // Always show success to prevent email enumeration
        this.isLoading.set(false);
        this.submitted.set(true);
      }
    });
  }
}

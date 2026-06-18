// features/auth/login/login.component.ts
import { Component, inject, signal, ViewChildren, ElementRef, QueryList, OnDestroy } from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { AuthService } from '../../../core/services/auth.service';
import { LoginPayload } from '../../../core/models/user.model';

interface LoginResponseData {
  accessToken?: string;
  requiresOtp?: boolean;
  email?: string;
  message?: string;
  expiresInMinutes?: number;
}
import { ThemeService } from '../../../shared/services/theme.service';
import { I18nService } from '../../../shared/services/i18n.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    FormsModule, RouterLink,
    ButtonModule, InputTextModule,
    InputGroupModule, InputGroupAddonModule,
    TranslatePipe
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnDestroy {
  private authService   = inject(AuthService);
  private router        = inject(Router);
  private route         = inject(ActivatedRoute);
  readonly themeService = inject(ThemeService);
  private i18nService   = inject(I18nService);
  private toastr        = inject(ToastrService);

  // identifiant = téléphone ou email — détection automatique côté backend
  formData: LoginPayload = { identifiant: '', motDePasse: '' };

  isLoading    = signal(false);
  showPassword = signal(false);

  requiresOtp  = signal(false);
  otpEmail     = signal('');
  otpCode      = '';
  otpDigits: string[] = ['', '', '', '', '', ''];

  otpSecondsLeft = signal(0);
  private otpTimerRef: ReturnType<typeof setInterval> | null = null;
  private otpTimerActive = false;

  @ViewChildren('otpInput') otpInputs!: QueryList<ElementRef<HTMLInputElement>>;

  get identifiantIcon(): string {
    return this.formData.identifiant.includes('@') ? 'pi pi-envelope' : 'pi pi-phone';
  }

  get otpTimeDisplay(): string {
    const s = this.otpSecondsLeft();
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  get otpExpired(): boolean {
    return this.requiresOtp() && this.otpTimerActive && this.otpSecondsLeft() === 0;
  }

  togglePassword() { this.showPassword.update(v => !v); }
  toggleTheme()    { this.themeService.toggle(); }
  toggleLang()     { this.i18nService.toggle(); }

  ngOnDestroy() { this.clearOtpTimer(); }

  onSubmit() {
    if (!this.formData.identifiant || !this.formData.motDePasse) {
      this.toastr.error(this.i18nService.t('AUTH.LOGIN.ERR_FIELDS'), 'Erreur');
      return;
    }
    this.isLoading.set(true);

    this.authService.login(this.formData).subscribe({
      next: (response: LoginResponseData) => {
        this.isLoading.set(false);
        if (response.requiresOtp) {
          this.requiresOtp.set(true);
          this.otpEmail.set(response.email ?? '');
          this.startOtpTimer(response.expiresInMinutes ?? 10);
        } else {
          const role = this.authService.userRole();
          if (role) this.redirectAfterLogin(role);
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        this.toastr.error(
          err?.error?.error ?? err?.error?.message ?? this.i18nService.t('AUTH.LOGIN.ERR_CREDENTIALS'),
          'Erreur de connexion'
        );
      }
    });
  }

  verifyOtp() {
    if (!this.otpCode || this.otpCode.length !== 6) {
      this.toastr.error('Veuillez entrer un code à 6 chiffres.', 'Code invalide');
      return;
    }
    this.isLoading.set(true);

    this.authService.verifyOtp(this.otpEmail(), this.otpCode).subscribe({
      next: (user) => {
        this.isLoading.set(false);
        this.clearOtpTimer();
        if (user && user.role) this.redirectAfterLogin(user.role);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.toastr.error(
          err?.error?.error ?? err?.error?.message ?? 'Code OTP incorrect.',
          'Erreur de vérification'
        );
        this.otpCode = '';
        this.otpDigits = ['', '', '', '', '', ''];
      }
    });
  }

  resendOtp() {
    if (this.isLoading()) return;
    this.isLoading.set(true);
    this.clearOtpTimer();
    this.otpCode = '';
    this.otpDigits = ['', '', '', '', '', ''];

    this.authService.login(this.formData).subscribe({
      next: (response: LoginResponseData) => {
        this.isLoading.set(false);
        if (response.requiresOtp) {
          this.startOtpTimer(response.expiresInMinutes ?? 10);
          this.toastr.success(this.i18nService.t('AUTH.LOGIN.OTP_RESENT'), 'Code renvoyé');
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        this.toastr.error(err?.error?.error ?? 'Impossible de renvoyer le code.', 'Erreur');
      }
    });
  }

  cancelOtp() {
    this.requiresOtp.set(false);
    this.clearOtpTimer();
    this.otpCode = '';
    this.otpDigits = ['', '', '', '', '', ''];
  }

  onOtpChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) {
      setTimeout(() => this.otpDigits[index] = '', 0);
      return;
    }

    this.otpCode = this.otpDigits.join('');

    if (value && index < 5) {
      this.otpInputs.toArray()[index + 1].nativeElement.focus();
    }

    if (this.otpCode.length === 6) {
      this.verifyOtp();
    }
  }

  onOtpKeyDown(index: number, event: KeyboardEvent) {
    if (event.key === 'Backspace') {
      if (!this.otpDigits[index] && index > 0) {
        this.otpDigits[index - 1] = '';
        this.otpCode = this.otpDigits.join('');
        this.otpInputs.toArray()[index - 1].nativeElement.focus();
      } else {
        this.otpDigits[index] = '';
        this.otpCode = this.otpDigits.join('');
      }
    } else if (event.key === 'ArrowLeft' && index > 0) {
      this.otpInputs.toArray()[index - 1].nativeElement.focus();
    } else if (event.key === 'ArrowRight' && index < 5) {
      this.otpInputs.toArray()[index + 1].nativeElement.focus();
    }
  }

  onOtpPaste(event: ClipboardEvent) {
    event.preventDefault();
    const pastedData = event.clipboardData?.getData('text');
    if (!pastedData) return;

    const numbers = pastedData.replace(/\D/g, '').substring(0, 6);
    if (numbers.length === 0) return;

    for (let i = 0; i < numbers.length; i++) {
      this.otpDigits[i] = numbers[i];
    }
    this.otpCode = this.otpDigits.join('');

    const focusIndex = Math.min(numbers.length, 5);
    this.otpInputs.toArray()[focusIndex].nativeElement.focus();

    if (this.otpCode.length === 6) {
      this.verifyOtp();
    }
  }

  private startOtpTimer(minutes: number) {
    this.clearOtpTimer();
    this.otpTimerActive = true;
    this.otpSecondsLeft.set(minutes * 60);
    this.otpTimerRef = setInterval(() => {
      if (this.otpSecondsLeft() > 0) {
        this.otpSecondsLeft.update(s => s - 1);
      } else {
        this.clearOtpTimer();
      }
    }, 1000);
  }

  private clearOtpTimer() {
    if (this.otpTimerRef) {
      clearInterval(this.otpTimerRef);
      this.otpTimerRef = null;
    }
    this.otpTimerActive = false;
  }

  private redirectAfterLogin(role: string) {
    if (this.authService.doitChangerMotDePasse()) {
      this.toastr.warning(
        this.i18nService.t('AUTH.LOGIN.CHANGE_PWD_REQUIRED'),
        'Action requise',
        { timeOut: 7000 }
      );
    }

    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    if (returnUrl && !returnUrl.startsWith('/auth')) {
      this.router.navigateByUrl(returnUrl);
      return;
    }

    const redirectMap: Record<string, string> = {
      PATIENT:          '/patient/dashboard',
      ASC:              '/asc/consultations',
      ASC_SUPERVISOR:   '/asc/consultations',
      MEDECIN:          '/medecin/dashboard',
      PHARMACIEN:       '/pharmacien/ordonnances',
      ADMIN_STRUCTURE:  '/admin-structure/dashboard',
      ADMIN_REGIONAL:   '/admin/analytics',
      ADMIN_NATIONAL:   '/admin/analytics',
      SUPER_ADMIN:      '/admin/analytics'
    };
    this.router.navigate([redirectMap[role] ?? '/auth/login']);
  }
}

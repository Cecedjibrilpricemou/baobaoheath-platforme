import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { ProfilModalComponent } from '../profil-modal/profil-modal.component';

@Component({
  selector: 'app-medecin-layout',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet, TranslatePipe, ProfilModalComponent],
  templateUrl: './medecin-layout.component.html',
  styleUrl: './medecin-layout.component.scss'
})
export class MedecinLayoutComponent {
  private authService   = inject(AuthService);
  readonly themeService = inject(ThemeService);
  private i18nService   = inject(I18nService);

  currentUser           = this.authService.currentUser;
  doitChangerMotDePasse = this.authService.doitChangerMotDePasse;
  sidebarOpen           = signal(false);
  showLogoutConfirm     = signal(false);
  showProfil            = signal(false);

  toggleSidebar()  { this.sidebarOpen.update(v => !v); }
  closeSidebar()   { this.sidebarOpen.set(false); }
  toggleTheme()    { this.themeService.toggle(); }
  toggleLang()     { this.i18nService.toggle(); }
  askLogout()      { this.showLogoutConfirm.set(true); }
  cancelLogout()   { this.showLogoutConfirm.set(false); }
  confirmLogout()  { this.showLogoutConfirm.set(false); this.authService.logout(); }

  getInitiales(): string {
    const u = this.currentUser();
    if (!u) return '??';
    return `${u.prenom?.charAt(0) ?? ''}${u.nom?.charAt(0) ?? ''}`.toUpperCase();
  }

  navItems = [
    { labelKey: 'MEDECIN.NAV_DASHBOARD',    icon: 'pi-home',         route: '/medecin/dashboard'     },
    { labelKey: 'MEDECIN.NAV_CONSULTATIONS', icon: 'pi-check-circle', route: '/medecin/consultations' },
    { labelKey: 'MEDECIN.NAV_MESSAGERIE',    icon: 'pi-comments',     route: '/medecin/messagerie'    }
  ];
}

// shared/components/asc-layout/asc-layout.component.ts
import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-asc-layout',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet, TranslatePipe],
  templateUrl: './asc-layout.component.html',
  styleUrl: './asc-layout.component.scss'
})
export class AscLayoutComponent {
  private authService   = inject(AuthService);
  readonly themeService = inject(ThemeService);
  private i18nService   = inject(I18nService);

  currentUser       = this.authService.currentUser;
  sidebarOpen       = signal(false);
  showLogoutConfirm = signal(false); // confirmation déconnexion

  toggleSidebar()  { this.sidebarOpen.update(v => !v); }
  closeSidebar()   { this.sidebarOpen.set(false); }
  toggleTheme()    { this.themeService.toggle(); }
  toggleLang()     { this.i18nService.toggle(); }

  // Demande confirmation avant de déconnecter
  askLogout()      { this.showLogoutConfirm.set(true); }
  cancelLogout()   { this.showLogoutConfirm.set(false); }
  confirmLogout()  { this.showLogoutConfirm.set(false); this.authService.logout(); }

  getInitiales(): string {
    const u = this.currentUser();
    if (!u) return '??';
    return `${u.prenom?.charAt(0) ?? ''}${u.nom?.charAt(0) ?? ''}`.toUpperCase();
  }

  navItems = [
    { labelKey: 'ASC.NAV_CONSULTATIONS', icon: 'pi-heart',   route: '/asc/consultations' },
    { labelKey: 'ASC.NAV_STOCKS',        icon: 'pi-box',     route: '/asc/stocks'        },
    { labelKey: 'ASC.NAV_PLANNING',      icon: 'pi-calendar',route: '/asc/planning'      }
  ];
}
